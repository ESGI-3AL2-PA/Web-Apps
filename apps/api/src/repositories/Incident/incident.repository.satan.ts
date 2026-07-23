import { quote, type SatanClient } from "@repo/satan";
import type { Incident } from "../../entities/incident.entity.js";
import type { IIncidentRepository } from "./incident.repository.js";
import { containsAny, eq, paginate, where } from "../satan.helpers.js";

/**
 * Implémentation SATAN QL du repository des signalements. Utilise SATAN pour la
 * lecture par id, les suppressions et la liste paginée (COUNT + recherche
 * CONTAINS) ; délègue à Mongo les stats en `$group` et les create/update qui
 * touchent le tableau `history[]`.
 */
export class SatanIncidentRepository implements IIncidentRepository {
  constructor(
    private readonly mongo: IIncidentRepository,
    private readonly satan: SatanClient,
  ) {}

  async getIncidentById(id: string): Promise<Incident | null> {
    const rows = (await this.satan.query(`FIND incidents WHERE _id = ${quote(id)}`)) as Incident[];
    return rows[0] ?? null;
  }

  async deleteIncident(id: string): Promise<boolean> {
    const res = (await this.satan.query(`DELETE FROM incidents WHERE _id = ${quote(id)}`)) as { deletedCount: number };
    return res.deletedCount > 0;
  }

  async deleteByReporter(reporterId: string): Promise<void> {
    await this.satan.query(`DELETE FROM incidents WHERE reporterId = ${quote(reporterId)}`);
  }

  getIncidents(params: Parameters<IIncidentRepository["getIncidents"]>[0]) {
    const { search, status, category, districtId, reporterId, assignedTo, page = 1, limit = 20 } = params;
    const clause = where([
      search && containsAny(["description", "category"], search),
      status && eq("status", status),
      category && eq("category", category),
      districtId && eq("districtId", districtId),
      reporterId && eq("reporterId", reporterId),
      assignedTo && eq("assignedTo", assignedTo),
    ]);
    return paginate<Incident>(this.satan, "incidents", clause, { page, limit });
  }

  // --- délégué à Mongo (agrégation / écritures sur history[]) ---
  ensureIndexes(): Promise<void> {
    return this.mongo.ensureIndexes();
  }
  createIncident(data: Omit<Incident, "id" | "createdAt" | "updatedAt">): Promise<Incident> {
    return this.mongo.createIncident(data);
  }
  updateIncident(
    id: string,
    data: Partial<Omit<Incident, "id" | "createdAt" | "updatedAt">>,
  ): Promise<Incident | null> {
    return this.mongo.updateIncident(id, data);
  }
  getStats(params?: { districtId?: string; reporterId?: string }) {
    return this.mongo.getStats(params);
  }
}
