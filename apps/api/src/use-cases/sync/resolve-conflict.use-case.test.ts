import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import { InMemorySyncConflictsRepository } from "../../repositories/Sync/sync-conflicts.repository.in-memory.js";
import { InMemorySyncWriterRepository } from "../../repositories/Sync/sync-writer.repository.in-memory.js";
import { resolveConflictUseCase } from "./resolve-conflict.use-case.js";

const graph = {
  upsertIncident: vi.fn(async () => {}),
  deleteIncident: vi.fn(async () => {}),
  linkUserReportedIncident: vi.fn(async () => {}),
  linkDistrictContainsIncident: vi.fn(async () => {}),
} as unknown as IGraphRepository;

let writer: InMemorySyncWriterRepository;
let conflicts: InMemorySyncConflictsRepository;

const resolve = (id: string, body: Parameters<ReturnType<typeof resolveConflictUseCase>>[1], by = "operator-1") =>
  resolveConflictUseCase({ writer, conflicts, graph })(id, body, by);

// A record edited offline, quarantined, and still carrying the raising instance's stamp.
const seedConflict = async () => {
  writer.docs.set("incident:i-1", {
    _id: "i-1",
    districtId: "d1",
    description: "server value",
    updatedAt: "2026-07-18T12:00:00.000Z",
    _sync: { origin: "sync", occurredAt: "2026-07-18T11:00:00.000Z", instanceId: "it-raiser" },
  });
  return conflicts.create({
    entity: "incident",
    mongoId: "i-1",
    type: "update",
    originInstanceId: "it-raiser",
    localData: { description: "local value" },
    serverData: { description: "server value" },
    baseUpdatedAt: "2026-07-17T00:00:00.000Z",
  });
};

beforeEach(() => {
  writer = new InMemorySyncWriterRepository();
  conflicts = new InMemorySyncConflictsRepository();
  vi.clearAllMocks();
});

describe("resolveConflictUseCase — provenance", () => {
  // The resolved state must reach EVERY instance, including the one whose push raised
  // the conflict — that instance needs the pull to clear its pending row (§6.3/§6.5).
  // Leaving `_sync` on the doc would make the watcher tag the entry with that instance
  // id, and `excludeInstance` would hide it from exactly the client that needs it.
  it.each(["local", "server", "merged"] as const)("clears the sync stamp when resolving as %s", async (resolution) => {
    const conflict = await seedConflict();

    const result = await resolve(conflict.id, {
      resolution,
      data: resolution === "merged" ? { description: "merged value" } : undefined,
    });

    expect(result).toEqual({ kind: "resolved", resolution });
    const doc = writer.docs.get("incident:i-1")!;
    expect(doc._sync).toBeUndefined();
    expect(doc.updatedAt).not.toBe("2026-07-18T12:00:00.000Z"); // re-propagated
  });

  it("applies the captured local snapshot on `local`", async () => {
    const conflict = await seedConflict();

    await resolve(conflict.id, { resolution: "local" });

    expect(writer.docs.get("incident:i-1")!.description).toBe("local value");
  });

  it("keeps the server document on `server` and only touches it", async () => {
    const conflict = await seedConflict();

    await resolve(conflict.id, { resolution: "server" });

    expect(writer.docs.get("incident:i-1")!.description).toBe("server value");
  });

  it("applies the operator's merge on `merged`", async () => {
    const conflict = await seedConflict();

    await resolve(conflict.id, { resolution: "merged", data: { description: "merged value" } });

    expect(writer.docs.get("incident:i-1")!.description).toBe("merged value");
  });
});

describe("resolveConflictUseCase — guards", () => {
  it("404s an unknown conflict", async () => {
    expect(await resolve("nope", { resolution: "server" })).toEqual({ kind: "not-found" });
  });

  it("is a no-op on a second resolve", async () => {
    const conflict = await seedConflict();
    await resolve(conflict.id, { resolution: "server" });

    expect(await resolve(conflict.id, { resolution: "local" })).toEqual({ kind: "already-resolved" });
    // The first decision stands — the late `local` must not overwrite it.
    expect(writer.docs.get("incident:i-1")!.description).toBe("server value");
  });

  it("records who resolved it", async () => {
    const conflict = await seedConflict();

    await resolve(conflict.id, { resolution: "server" }, "admin-7");

    expect(conflicts.rows[0]!).toMatchObject({ status: "resolved", resolvedBy: "admin-7", resolution: "server" });
  });

  it("recreates a record deleted underneath the conflict", async () => {
    const conflict = await seedConflict();
    writer.docs.delete("incident:i-1");

    await resolve(conflict.id, { resolution: "local" });

    expect(writer.docs.get("incident:i-1")!.description).toBe("local value");
    expect(writer.docs.get("incident:i-1")!._sync).toBeUndefined();
  });
});
