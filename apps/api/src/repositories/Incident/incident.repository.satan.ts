import { quote, type SatanClient } from "@repo/satan";
import type { Incident } from "../../entities/incident.entity.js";
import type { IIncidentRepository } from "./incident.repository.js";

/** SATAN QL for id lookup and deletes; Mongo for list, the `$group` stats and
 *  the `history[]`-touching create/update. */
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

  // --- delegated to Mongo ---
  ensureIndexes(): Promise<void> {
    return this.mongo.ensureIndexes();
  }
  getIncidents(params: Parameters<IIncidentRepository["getIncidents"]>[0]) {
    return this.mongo.getIncidents(params);
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
  getStats(districtId?: string) {
    return this.mongo.getStats(districtId);
  }
}
