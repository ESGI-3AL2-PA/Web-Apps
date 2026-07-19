import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IngestEventDto } from "@repo/contracts";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import { InMemorySyncConflictsRepository } from "../../repositories/Sync/sync-conflicts.repository.in-memory.js";
import { InMemorySyncWriterRepository } from "../../repositories/Sync/sync-writer.repository.in-memory.js";
import type { SyncScope } from "../../sync/sync-scope.js";
import { ingestUseCase } from "./ingest.use-case.js";

const graph = {
  upsertUser: vi.fn(async () => {}),
  deleteUser: vi.fn(async () => {}),
  upsertIncident: vi.fn(async () => {}),
  deleteIncident: vi.fn(async () => {}),
  linkUserLivesIn: vi.fn(async () => {}),
  linkUserReportedIncident: vi.fn(async () => {}),
  linkDistrictContainsIncident: vi.fn(async () => {}),
} as unknown as IGraphRepository;

let writer: InMemorySyncWriterRepository;
let conflicts: InMemorySyncConflictsRepository;

const run = (events: IngestEventDto[], scope: SyncScope = { districtId: "d1" }, instanceId = "it-1") =>
  ingestUseCase({ writer, conflicts, graph })({ events, instanceId, scope });

const event = (over: Partial<IngestEventDto>): IngestEventDto => ({
  id: 1,
  entity: "incident",
  operation: "INSERT",
  mongoId: null,
  data: { districtId: "d1", category: "voirie", description: "trou", reporterId: "u1" },
  occurredAt: "2026-07-19T10:00:00.000Z",
  ...over,
});

beforeEach(() => {
  let seq = 0;
  writer = new InMemorySyncWriterRepository();
  writer.now = () => `2026-07-19T00:00:${String(++seq).padStart(2, "0")}.000Z`;
  conflicts = new InMemorySyncConflictsRepository();
  let cSeq = 0;
  conflicts.nextId = () => `c-${++cSeq}`;
  vi.clearAllMocks();
});

describe("ingestUseCase — district authorization", () => {
  it("rejects an INSERT whose payload targets another district", async () => {
    const result = await run([event({ id: 42, data: { districtId: "d2", category: "voirie", description: "x" } })]);

    expect(result.rejected).toEqual([{ id: 42, reason: "out-of-district" }]);
    expect(result.applied).toHaveLength(0);
    expect(result.conflicts).toHaveLength(0);
    // Never quarantined: an authorization failure must not enter the conflict queue.
    expect(conflicts.rows).toHaveLength(0);
    expect(writer.docs.size).toBe(0);
  });

  it("rejects an UPDATE by the SERVER doc's district, not the payload's", async () => {
    writer.docs.set("incident:i-9", {
      _id: "i-9",
      districtId: "d2",
      updatedAt: "2026-07-18T00:00:00.000Z",
    });

    // The client relabels its payload to the caller's own district to smuggle the write in.
    const result = await run([
      event({ id: 7, operation: "UPDATE", mongoId: "i-9", data: { districtId: "d1", description: "pwned" } }),
    ]);

    expect(result.rejected).toEqual([{ id: 7, reason: "out-of-district" }]);
    expect(writer.docs.get("incident:i-9")).toMatchObject({ districtId: "d2" });
  });

  it("rejects when the district cannot be determined (fail-closed)", async () => {
    const result = await run([event({ id: 3, data: { category: "voirie", description: "no district" } })]);

    expect(result.rejected).toEqual([{ id: 3, reason: "out-of-district" }]);
  });

  it("rejects everything for an admin bound to no district", async () => {
    const result = await run([event({ id: 5 })], { empty: true });

    expect(result.rejected).toEqual([{ id: 5, reason: "out-of-district" }]);
  });

  it("lets a superAdmin write any district", async () => {
    const result = await run([event({ id: 8, data: { districtId: "d9", category: "voirie", description: "x" } })], {
      all: true,
    });

    expect(result.rejected).toHaveLength(0);
    expect(result.applied).toHaveLength(1);
  });
});

describe("ingestUseCase — read-only entities", () => {
  it("rejects a district push without writing anything", async () => {
    const result = await run([
      event({ id: 11, entity: "district", operation: "UPDATE", mongoId: "d1", data: { name: "Renamed" } }),
    ]);

    expect(result.rejected).toEqual([{ id: 11, reason: "read-only-entity" }]);
    expect(result.applied).toHaveLength(0);
    expect(writer.docs.size).toBe(0);
  });

  it("rejects a district INSERT even for a superAdmin", async () => {
    const result = await run([event({ id: 12, entity: "district", data: { name: "New" } })], { all: true });

    expect(result.rejected).toEqual([{ id: 12, reason: "read-only-entity" }]);
  });
});

describe("ingestUseCase — apply paths", () => {
  it("acks an INSERT with the persisted updatedAt and an assigned mongoId", async () => {
    const result = await run([event({ id: 42 })]);

    expect(result.applied).toHaveLength(1);
    const applied = result.applied[0]!;
    expect(applied.id).toBe(42);
    expect(applied.operation).toBe("INSERT");
    expect(applied.updatedAt).toBe(writer.docs.get(`incident:${applied.mongoId}`)!.updatedAt);
  });

  it("drops server-owned fields from an untrusted payload", async () => {
    const result = await run([
      event({
        entity: "user",
        data: { email: "a@x.io", districtId: "d1", firstName: "A", lastName: "B", address: "x", role: "superAdmin" },
      }),
    ]);

    const doc = writer.docs.get(`user:${result.applied[0]!.mongoId}`)!;
    expect(doc.role).toBeUndefined();
    expect(doc.email).toBe("a@x.io");
  });

  it("stamps the originating instance so the watcher can echo-skip", async () => {
    const result = await run([event({})], { districtId: "d1" }, "it-7");

    expect(writer.docs.get(`incident:${result.applied[0]!.mongoId}`)!._sync).toEqual({
      origin: "sync",
      occurredAt: "2026-07-19T10:00:00.000Z",
      instanceId: "it-7",
    });
  });

  it("applies a DELETE and acks it with a null updatedAt", async () => {
    writer.docs.set("incident:i-1", { _id: "i-1", districtId: "d1", updatedAt: "2026-07-18T00:00:00.000Z" });

    const result = await run([
      event({ id: 9, operation: "DELETE", mongoId: "i-1", data: null, baseUpdatedAt: "2026-07-18T00:00:00.000Z" }),
    ]);

    expect(result.applied).toEqual([{ id: 9, mongoId: "i-1", operation: "DELETE", updatedAt: null }]);
    expect(writer.docs.has("incident:i-1")).toBe(false);
  });

  it("recreates a record the server no longer has (last-write-wins)", async () => {
    const result = await run([
      event({ id: 4, operation: "UPDATE", mongoId: "i-gone", baseUpdatedAt: "2026-07-18T00:00:00.000Z" }),
    ]);

    expect(result.conflicts).toHaveLength(0);
    expect(result.applied[0]!.mongoId).toBe("i-gone");
    expect(writer.docs.has("incident:i-gone")).toBe(true);
  });
});

describe("ingestUseCase — conflicts", () => {
  it("quarantines an UPDATE with a stale baseUpdatedAt instead of overwriting", async () => {
    writer.docs.set("incident:i-2", {
      _id: "i-2",
      districtId: "d1",
      description: "server wins",
      updatedAt: "2026-07-18T12:00:00.000Z",
    });

    const result = await run([
      event({
        id: 71,
        operation: "UPDATE",
        mongoId: "i-2",
        data: { description: "local edit" },
        baseUpdatedAt: "2026-07-17T00:00:00.000Z",
      }),
    ]);

    expect(result.applied).toHaveLength(0);
    expect(result.conflicts).toEqual([{ id: 71, mongoId: "i-2", conflictId: "c-1" }]);
    expect(writer.docs.get("incident:i-2")!.description).toBe("server wins");
    expect(conflicts.rows[0]!).toMatchObject({ type: "update", originInstanceId: "it-1" });
  });

  it("holds a record with an open conflict: refreshes the snapshot, raises no second row", async () => {
    writer.docs.set("incident:i-3", { _id: "i-3", districtId: "d1", updatedAt: "2026-07-18T12:00:00.000Z" });
    const stale = { operation: "UPDATE" as const, mongoId: "i-3", baseUpdatedAt: "2026-07-17T00:00:00.000Z" };

    await run([event({ id: 1, ...stale, data: { description: "first" } })]);
    const result = await run([event({ id: 2, ...stale, data: { description: "second" } })]);

    expect(conflicts.rows).toHaveLength(1);
    expect(conflicts.rows[0]!.localData).toMatchObject({ description: "second" });
    expect(result.conflicts).toEqual([{ id: 2, mongoId: "i-3", conflictId: "c-1" }]);
  });

  it("raises a duplicate conflict on a first INSERT matching an existing user email", async () => {
    writer.docs.set("user:u-existing", {
      _id: "u-existing",
      email: "a@x.io",
      districtId: "d1",
      passwordHash: "secret",
      updatedAt: "2026-07-18T00:00:00.000Z",
    });

    const result = await run([
      event({ id: 55, entity: "user", data: { email: "a@x.io", districtId: "d1", firstName: "A" } }),
    ]);

    expect(result.applied).toHaveLength(0);
    // The existing _id comes back so the two rows converge on one record.
    expect(result.conflicts).toEqual([{ id: 55, mongoId: "u-existing", conflictId: "c-1" }]);
    expect(conflicts.rows[0]!.type).toBe("duplicate");
    expect(conflicts.rows[0]!.serverData).not.toHaveProperty("passwordHash");
  });

  it("treats an INSERT retry carrying a known mongoId as an idempotent upsert", async () => {
    writer.docs.set("incident:i-4", { _id: "i-4", districtId: "d1", updatedAt: "2026-07-18T00:00:00.000Z" });

    const result = await run([event({ id: 6, mongoId: "i-4", data: { districtId: "d1", description: "retry" } })]);

    expect(result.conflicts).toHaveLength(0);
    expect(result.applied[0]!.mongoId).toBe("i-4");
    expect(writer.docs.get("incident:i-4")!.description).toBe("retry");
  });
});

describe("ingestUseCase — total accounting", () => {
  it("rejects an UPDATE carrying no mongoId as unprocessable", async () => {
    const result = await run([event({ id: 20, operation: "UPDATE", mongoId: null })]);

    expect(result.rejected).toEqual([{ id: 20, reason: "unprocessable" }]);
    expect(result.applied).toHaveLength(0);
    expect(writer.docs.size).toBe(0);
  });

  it("rejects a DELETE carrying no mongoId as unprocessable", async () => {
    const result = await run([event({ id: 21, operation: "DELETE", mongoId: null, data: null })]);

    expect(result.rejected).toEqual([{ id: 21, reason: "unprocessable" }]);
    expect(result.applied).toHaveLength(0);
  });

  it("reports every submitted id exactly once across a mixed batch", async () => {
    writer.docs.set("incident:i-stale", {
      _id: "i-stale",
      districtId: "d1",
      updatedAt: "2026-07-18T12:00:00.000Z",
    });

    const batch: IngestEventDto[] = [
      event({ id: 101 }), // applied
      event({
        id: 102, // conflicted (stale base)
        operation: "UPDATE",
        mongoId: "i-stale",
        data: { description: "local" },
        baseUpdatedAt: "2026-07-17T00:00:00.000Z",
      }),
      event({ id: 103, data: { districtId: "d2", category: "x", description: "y" } }), // out-of-district
      event({ id: 104, entity: "district", data: { name: "nope" } }), // read-only-entity
      event({ id: 105, operation: "UPDATE", mongoId: null }), // unprocessable
    ];

    const result = await run(batch);

    const reported = [
      ...result.applied.map((e) => e.id),
      ...result.conflicts.map((e) => e.id),
      ...result.rejected.map((e) => e.id),
    ];

    // Never zero (a missing id strands the client's pending row forever) and never
    // twice (the client's row lifecycle would see contradictory instructions).
    expect(reported).toHaveLength(batch.length);
    expect(new Set(reported).size).toBe(batch.length);
    expect([...reported].sort((a, b) => a - b)).toEqual([101, 102, 103, 104, 105]);

    expect(result.applied.map((e) => e.id)).toEqual([101]);
    expect(result.conflicts.map((e) => e.id)).toEqual([102]);
    expect(result.rejected).toEqual([
      { id: 103, reason: "out-of-district" },
      { id: 104, reason: "read-only-entity" },
      { id: 105, reason: "unprocessable" },
    ]);
  });
});
