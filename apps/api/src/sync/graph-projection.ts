/**
 * Couche sync : reflète une écriture appliquée par la sync dans la projection Neo4j.
 *
 * Le writer de sync écrit directement dans Mongo, court-circuitant les use-cases
 * incident/user qui maintiennent normalement le graphe — sans ceci, les recommandations
 * dériveraient des données poussées par l'app desktop. Best-effort, comme toute autre
 * écriture de graphe (`syncGraph` logge et continue), car Mongo reste la source de vérité.
 */
import type { SyncEntity, SyncOperation } from "@repo/contracts";
import type { IGraphRepository } from "../repositories/Graph/graph.repository.js";
import { syncGraph } from "../repositories/Graph/graph.sync.js";

type Doc = Record<string, unknown>;

// Coercition défensive vers string : un document de sync est du JSON non typé.
const str = (v: unknown): string => (typeof v === "string" ? v : "");

/**
 * Applique dans Neo4j l'effet d'une écriture de sync (INSERT/UPDATE/DELETE) pour une
 * entité `user` ou `incident`. Les quartiers ne sont jamais écrits par la sync et sont
 * ignorés. Toutes les écritures passent par `syncGraph` (best-effort, loggé).
 */
export const projectSyncWrite = async (
  graph: IGraphRepository,
  entity: SyncEntity,
  operation: SyncOperation,
  mongoId: string,
  doc: Doc | null,
): Promise<void> => {
  if (entity === "district") return; // les quartiers ne sont jamais écrits par la sync

  if (operation === "DELETE") {
    await syncGraph(`sync.delete${entity}(${mongoId})`, () =>
      entity === "user" ? graph.deleteUser(mongoId) : graph.deleteIncident(mongoId),
    );
    return;
  }

  if (!doc) return;

  if (entity === "user") {
    await syncGraph(`sync.upsertUser(${mongoId})`, () =>
      graph.upsertUser({
        id: mongoId,
        name: `${str(doc.firstName)} ${str(doc.lastName)}`.trim(),
        email: str(doc.email),
        role: str(doc.role),
      }),
    );
    if (str(doc.districtId)) {
      await syncGraph(`sync.linkUserLivesIn(${mongoId})`, () =>
        graph.linkUserLivesIn(mongoId, str(doc.districtId), undefined, str(doc.address) || undefined),
      );
    }
    return;
  }

  await syncGraph(`sync.upsertIncident(${mongoId})`, () =>
    graph.upsertIncident({ id: mongoId, category: str(doc.category), status: str(doc.status) }),
  );
  if (str(doc.reporterId)) {
    await syncGraph(`sync.linkUserReportedIncident(${mongoId})`, () =>
      graph.linkUserReportedIncident(str(doc.reporterId), mongoId),
    );
  }
  if (str(doc.districtId)) {
    await syncGraph(`sync.linkDistrictContainsIncident(${mongoId})`, () =>
      graph.linkDistrictContainsIncident(str(doc.districtId), mongoId),
    );
  }
};
