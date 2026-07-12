import type { Incident } from "../../entities/incident.entity.js";
import type { SatanQueryRunner } from "../satan/satan-runner.js";
import type { IIncidentRepository } from "./incident.repository.js";

/** SATAN QL for id lookup and deletes; Mongo for list, the `$group` stats and
 *  the `history[]`-touching create/update. */
export class SatanIncidentRepository implements IIncidentRepository {
  constructor(
    private readonly mongo: IIncidentRepository,
    private readonly satan: SatanQueryRunner,
  ) {}

  getIncidentById(id: string): Promise<Incident | null> {
    return this.satan.findOne<Incident>(`FIND incidents WHERE _id = ${this.satan.q(id)}`);
  }

  async deleteIncident(id: string): Promise<boolean> {
    const deleted = await this.satan.delete(`DELETE FROM incidents WHERE _id = ${this.satan.q(id)}`);
    return deleted > 0;
  }

  async deleteByReporter(reporterId: string): Promise<void> {
    await this.satan.delete(`DELETE FROM incidents WHERE reporterId = ${this.satan.q(reporterId)}`);
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
