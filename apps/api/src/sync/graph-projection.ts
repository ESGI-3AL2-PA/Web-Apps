/**
 * Mirrors a sync-applied write into the Neo4j projection.
 *
 * The sync writer goes straight to Mongo, bypassing the incident/user use-cases that
 * normally maintain the graph — without this, recommendations would drift away from
 * the data the desktop app pushes. Best-effort, like every other graph write
 * (`syncGraph` logs and continues), because Mongo remains the source of truth.
 */
import type { SyncEntity, SyncOperation } from "@repo/contracts";
import type { IGraphRepository } from "../repositories/Graph/graph.repository.js";
import { syncGraph } from "../repositories/Graph/graph.sync.js";

type Doc = Record<string, unknown>;

const str = (v: unknown): string => (typeof v === "string" ? v : "");

export const projectSyncWrite = async (
  graph: IGraphRepository,
  entity: SyncEntity,
  operation: SyncOperation,
  mongoId: string,
  doc: Doc | null,
): Promise<void> => {
  if (entity === "district") return; // districts are never written by sync

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
