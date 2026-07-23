// Suite de tests du cas d'usage de résolution de conflit (resolveConflictUseCase).
// Vérifie deux aspects : la provenance (l'écriture résolue efface le stamp _sync pour
// atteindre toutes les instances, y compris celle ayant levé le conflit) et les gardes
// (404, idempotence sur double résolution, traçabilité du resolvedBy, recréation d'un
// doc supprimé sous le conflit). Repositories in-memory + graphe mocké.
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

// Amorce : un enregistrement édité offline, mis en quarantaine, et portant encore le
// stamp _sync de l'instance qui a levé le conflit.
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

// Provenance : l'écriture résolue doit être vue comme d'origine serveur par le watcher.
describe("resolveConflictUseCase — provenance", () => {
  // L'état résolu doit atteindre CHAQUE instance, y compris celle dont le push a levé le
  // conflit — cette instance a besoin du pull pour vider sa ligne en attente (§6.3/§6.5).
  // Laisser `_sync` sur le doc ferait taguer l'entrée par le watcher avec cet instanceId,
  // et `excludeInstance` la cacherait précisément au client qui en a besoin.
  it.each(["local", "server", "merged"] as const)("clears the sync stamp when resolving as %s", async (resolution) => {
    const conflict = await seedConflict();

    const result = await resolve(conflict.id, {
      resolution,
      data: resolution === "merged" ? { description: "merged value" } : undefined,
    });

    expect(result).toEqual({ kind: "resolved", resolution });
    const doc = writer.docs.get("incident:i-1")!;
    expect(doc._sync).toBeUndefined();
    expect(doc.updatedAt).not.toBe("2026-07-18T12:00:00.000Z"); // re-propagé
  });

  // Résolution `local` : on applique le snapshot local capturé.
  it("applies the captured local snapshot on `local`", async () => {
    const conflict = await seedConflict();

    await resolve(conflict.id, { resolution: "local" });

    expect(writer.docs.get("incident:i-1")!.description).toBe("local value");
  });

  // Résolution `server` : on garde le doc serveur et on se contente de le « toucher ».
  it("keeps the server document on `server` and only touches it", async () => {
    const conflict = await seedConflict();

    await resolve(conflict.id, { resolution: "server" });

    expect(writer.docs.get("incident:i-1")!.description).toBe("server value");
  });

  // Résolution `merged` : on applique les données fusionnées fournies par l'opérateur.
  it("applies the operator's merge on `merged`", async () => {
    const conflict = await seedConflict();

    await resolve(conflict.id, { resolution: "merged", data: { description: "merged value" } });

    expect(writer.docs.get("incident:i-1")!.description).toBe("merged value");
  });
});

// Gardes : conflit inconnu, double résolution, traçabilité, recréation d'un doc supprimé.
describe("resolveConflictUseCase — guards", () => {
  // Un conflit inconnu renvoie « not-found » (404).
  it("404s an unknown conflict", async () => {
    expect(await resolve("nope", { resolution: "server" })).toEqual({ kind: "not-found" });
  });

  // Une seconde résolution est un no-op : la première décision reste en place.
  it("is a no-op on a second resolve", async () => {
    const conflict = await seedConflict();
    await resolve(conflict.id, { resolution: "server" });

    expect(await resolve(conflict.id, { resolution: "local" })).toEqual({ kind: "already-resolved" });
    // La première décision tient — le `local` tardif ne doit pas l'écraser.
    expect(writer.docs.get("incident:i-1")!.description).toBe("server value");
  });

  // Le resolvedBy (qui a résolu) est enregistré sur le conflit.
  it("records who resolved it", async () => {
    const conflict = await seedConflict();

    await resolve(conflict.id, { resolution: "server" }, "admin-7");

    expect(conflicts.rows[0]!).toMatchObject({ status: "resolved", resolvedBy: "admin-7", resolution: "server" });
  });

  // Un enregistrement supprimé sous le conflit est recréé à partir de la décision.
  it("recreates a record deleted underneath the conflict", async () => {
    const conflict = await seedConflict();
    writer.docs.delete("incident:i-1");

    await resolve(conflict.id, { resolution: "local" });

    expect(writer.docs.get("incident:i-1")!.description).toBe("local value");
    expect(writer.docs.get("incident:i-1")!._sync).toBeUndefined();
  });
});
