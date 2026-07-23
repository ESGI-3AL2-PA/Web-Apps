// Suite de tests du cas d'usage d'ingestion sync (ingestUseCase).
// Vérifie les quatre familles de comportements : autorisation par quartier, entités
// en lecture seule, chemins d'application (INSERT/UPDATE/DELETE), gestion des conflits
// (quarantaine, doublons, upsert idempotent) et comptabilité totale (chaque id reporté
// exactement une fois). S'appuie sur des repositories in-memory et un graphe mocké.
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

// Raccourci : exécute le cas d'usage avec un scope par défaut lié au quartier « d1 ».
const run = (events: IngestEventDto[], scope: SyncScope = { districtId: "d1" }, instanceId = "it-1") =>
  ingestUseCase({ writer, conflicts, graph })({ events, instanceId, scope });

// Fabrique un événement d'ingestion valide (INSERT d'un signalement dans d1) surchargeable.
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
  // Horloges déterministes : updatedAt incrémental et ids de conflit séquentiels (c-1, c-2…).
  let seq = 0;
  writer = new InMemorySyncWriterRepository();
  writer.now = () => `2026-07-19T00:00:${String(++seq).padStart(2, "0")}.000Z`;
  conflicts = new InMemorySyncConflictsRepository();
  let cSeq = 0;
  conflicts.nextId = () => `c-${++cSeq}`;
  vi.clearAllMocks();
});

// Autorisation par quartier : c'est toujours le doc serveur (pas le payload) qui tranche.
describe("ingestUseCase — district authorization", () => {
  // Un INSERT visant un autre quartier est rejeté, jamais mis en quarantaine.
  it("rejects an INSERT whose payload targets another district", async () => {
    const result = await run([event({ id: 42, data: { districtId: "d2", category: "voirie", description: "x" } })]);

    expect(result.rejected).toEqual([{ id: 42, reason: "out-of-district" }]);
    expect(result.applied).toHaveLength(0);
    expect(result.conflicts).toHaveLength(0);
    // Jamais mis en quarantaine : un échec d'autorisation ne doit pas entrer dans la file des conflits.
    expect(conflicts.rows).toHaveLength(0);
    expect(writer.docs.size).toBe(0);
  });

  // Sur un UPDATE, c'est le quartier du doc SERVEUR qui décide, pas celui du payload.
  it("rejects an UPDATE by the SERVER doc's district, not the payload's", async () => {
    writer.docs.set("incident:i-9", {
      _id: "i-9",
      districtId: "d2",
      updatedAt: "2026-07-18T00:00:00.000Z",
    });

    // Le client réétiquette son payload vers son propre quartier pour tenter de faire passer l'écriture.
    const result = await run([
      event({ id: 7, operation: "UPDATE", mongoId: "i-9", data: { districtId: "d1", description: "pwned" } }),
    ]);

    expect(result.rejected).toEqual([{ id: 7, reason: "out-of-district" }]);
    expect(writer.docs.get("incident:i-9")).toMatchObject({ districtId: "d2" });
  });

  // Quartier indéterminable → rejet (fail-closed, on refuse par défaut).
  it("rejects when the district cannot be determined (fail-closed)", async () => {
    const result = await run([event({ id: 3, data: { category: "voirie", description: "no district" } })]);

    expect(result.rejected).toEqual([{ id: 3, reason: "out-of-district" }]);
  });

  // Un admin rattaché à aucun quartier voit tout rejeté.
  it("rejects everything for an admin bound to no district", async () => {
    const result = await run([event({ id: 5 })], { empty: true });

    expect(result.rejected).toEqual([{ id: 5, reason: "out-of-district" }]);
  });

  // Un superAdmin peut écrire dans n'importe quel quartier.
  it("lets a superAdmin write any district", async () => {
    const result = await run([event({ id: 8, data: { districtId: "d9", category: "voirie", description: "x" } })], {
      all: true,
    });

    expect(result.rejected).toHaveLength(0);
    expect(result.applied).toHaveLength(1);
  });
});

// Entités en lecture seule : les quartiers ne peuvent pas être écrits via l'ingestion.
describe("ingestUseCase — read-only entities", () => {
  // Un push de quartier est rejeté sans rien écrire.
  it("rejects a district push without writing anything", async () => {
    const result = await run([
      event({ id: 11, entity: "district", operation: "UPDATE", mongoId: "d1", data: { name: "Renamed" } }),
    ]);

    expect(result.rejected).toEqual([{ id: 11, reason: "read-only-entity" }]);
    expect(result.applied).toHaveLength(0);
    expect(writer.docs.size).toBe(0);
  });

  // Même un superAdmin ne peut pas créer un quartier via l'ingestion.
  it("rejects a district INSERT even for a superAdmin", async () => {
    const result = await run([event({ id: 12, entity: "district", data: { name: "New" } })], { all: true });

    expect(result.rejected).toEqual([{ id: 12, reason: "read-only-entity" }]);
  });
});

// Chemins d'application : ce qui est effectivement persisté et acquitté au client.
describe("ingestUseCase — apply paths", () => {
  // Un INSERT est acquitté avec l'updatedAt persisté et un mongoId attribué.
  it("acks an INSERT with the persisted updatedAt and an assigned mongoId", async () => {
    const result = await run([event({ id: 42 })]);

    expect(result.applied).toHaveLength(1);
    const applied = result.applied[0]!;
    expect(applied.id).toBe(42);
    expect(applied.operation).toBe("INSERT");
    expect(applied.updatedAt).toBe(writer.docs.get(`incident:${applied.mongoId}`)!.updatedAt);
  });

  // Les champs appartenant au serveur (ex. role) sont retirés d'un payload non fiable.
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

  // L'instance émettrice est estampillée dans _sync pour que le watcher évite l'écho.
  it("stamps the originating instance so the watcher can echo-skip", async () => {
    const result = await run([event({})], { districtId: "d1" }, "it-7");

    expect(writer.docs.get(`incident:${result.applied[0]!.mongoId}`)!._sync).toEqual({
      origin: "sync",
      occurredAt: "2026-07-19T10:00:00.000Z",
      instanceId: "it-7",
    });
  });

  // Un DELETE est appliqué et acquitté avec un updatedAt null.
  it("applies a DELETE and acks it with a null updatedAt", async () => {
    writer.docs.set("incident:i-1", { _id: "i-1", districtId: "d1", updatedAt: "2026-07-18T00:00:00.000Z" });

    const result = await run([
      event({ id: 9, operation: "DELETE", mongoId: "i-1", data: null, baseUpdatedAt: "2026-07-18T00:00:00.000Z" }),
    ]);

    expect(result.applied).toEqual([{ id: 9, mongoId: "i-1", operation: "DELETE", updatedAt: null }]);
    expect(writer.docs.has("incident:i-1")).toBe(false);
  });

  // Un UPDATE sur un enregistrement disparu côté serveur le recrée (last-write-wins).
  it("recreates a record the server no longer has (last-write-wins)", async () => {
    const result = await run([
      event({ id: 4, operation: "UPDATE", mongoId: "i-gone", baseUpdatedAt: "2026-07-18T00:00:00.000Z" }),
    ]);

    expect(result.conflicts).toHaveLength(0);
    expect(result.applied[0]!.mongoId).toBe("i-gone");
    expect(writer.docs.has("incident:i-gone")).toBe(true);
  });
});

// Conflits : quarantaine plutôt qu'écrasement, dédoublonnage, upsert idempotent.
describe("ingestUseCase — conflicts", () => {
  // Un UPDATE avec un baseUpdatedAt périmé est mis en quarantaine, sans écraser le serveur.
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

  // Un enregistrement en conflit ouvert : le snapshot local est rafraîchi, aucune 2e ligne créée.
  it("holds a record with an open conflict: refreshes the snapshot, raises no second row", async () => {
    writer.docs.set("incident:i-3", { _id: "i-3", districtId: "d1", updatedAt: "2026-07-18T12:00:00.000Z" });
    const stale = { operation: "UPDATE" as const, mongoId: "i-3", baseUpdatedAt: "2026-07-17T00:00:00.000Z" };

    await run([event({ id: 1, ...stale, data: { description: "first" } })]);
    const result = await run([event({ id: 2, ...stale, data: { description: "second" } })]);

    expect(conflicts.rows).toHaveLength(1);
    expect(conflicts.rows[0]!.localData).toMatchObject({ description: "second" });
    expect(result.conflicts).toEqual([{ id: 2, mongoId: "i-3", conflictId: "c-1" }]);
  });

  // Un premier INSERT dont l'email correspond à un user existant lève un conflit « duplicate ».
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
    // L'_id existant est renvoyé pour que les deux lignes convergent vers un seul enregistrement.
    expect(result.conflicts).toEqual([{ id: 55, mongoId: "u-existing", conflictId: "c-1" }]);
    expect(conflicts.rows[0]!.type).toBe("duplicate");
    expect(conflicts.rows[0]!.serverData).not.toHaveProperty("passwordHash");
  });

  // Un réessai d'INSERT portant un mongoId connu est traité comme un upsert idempotent.
  it("treats an INSERT retry carrying a known mongoId as an idempotent upsert", async () => {
    writer.docs.set("incident:i-4", { _id: "i-4", districtId: "d1", updatedAt: "2026-07-18T00:00:00.000Z" });

    const result = await run([event({ id: 6, mongoId: "i-4", data: { districtId: "d1", description: "retry" } })]);

    expect(result.conflicts).toHaveLength(0);
    expect(result.applied[0]!.mongoId).toBe("i-4");
    expect(writer.docs.get("incident:i-4")!.description).toBe("retry");
  });
});

// Comptabilité totale : chaque id soumis est reporté exactement une fois (ni zéro, ni deux).
describe("ingestUseCase — total accounting", () => {
  // Un UPDATE sans mongoId est rejeté comme « unprocessable ».
  it("rejects an UPDATE carrying no mongoId as unprocessable", async () => {
    const result = await run([event({ id: 20, operation: "UPDATE", mongoId: null })]);

    expect(result.rejected).toEqual([{ id: 20, reason: "unprocessable" }]);
    expect(result.applied).toHaveLength(0);
    expect(writer.docs.size).toBe(0);
  });

  // Un DELETE sans mongoId est rejeté comme « unprocessable ».
  it("rejects a DELETE carrying no mongoId as unprocessable", async () => {
    const result = await run([event({ id: 21, operation: "DELETE", mongoId: null, data: null })]);

    expect(result.rejected).toEqual([{ id: 21, reason: "unprocessable" }]);
    expect(result.applied).toHaveLength(0);
  });

  // Sur un lot hétérogène, chaque id est reporté une et une seule fois, dans le bon bucket.
  it("reports every submitted id exactly once across a mixed batch", async () => {
    writer.docs.set("incident:i-stale", {
      _id: "i-stale",
      districtId: "d1",
      updatedAt: "2026-07-18T12:00:00.000Z",
    });

    const batch: IngestEventDto[] = [
      event({ id: 101 }), // appliqué
      event({
        id: 102, // conflit (base périmée)
        operation: "UPDATE",
        mongoId: "i-stale",
        data: { description: "local" },
        baseUpdatedAt: "2026-07-17T00:00:00.000Z",
      }),
      event({ id: 103, data: { districtId: "d2", category: "x", description: "y" } }), // hors quartier
      event({ id: 104, entity: "district", data: { name: "nope" } }), // entité en lecture seule
      event({ id: 105, operation: "UPDATE", mongoId: null }), // non traitable
    ];

    const result = await run(batch);

    const reported = [
      ...result.applied.map((e) => e.id),
      ...result.conflicts.map((e) => e.id),
      ...result.rejected.map((e) => e.id),
    ];

    // Jamais zéro (un id manquant bloquerait la ligne en attente du client à jamais) ni
    // deux fois (le cycle de vie de la ligne du client verrait des instructions contradictoires).
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
