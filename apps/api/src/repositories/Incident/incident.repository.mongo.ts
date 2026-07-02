import { randomUUID } from "crypto";
import type { Collection, Db, Filter } from "mongodb";
import type { Incident, IncidentStatus } from "../../entities/incident.entity.js";
import type { IIncidentRepository } from "./incident.repository.js";

type IncidentDoc = Omit<Incident, "id"> & { _id: string };

export class MongoIncidentRepository implements IIncidentRepository {
  private collection: Collection<IncidentDoc>;

  constructor(db: Db) {
    this.collection = db.collection("incidents");
  }

  async getIncidents(params: {
    search?: string;
    status?: string;
    category?: string;
    districtId?: string;
    reporterId?: string;
    assignedTo?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    data: Incident[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { search, status, category, districtId, reporterId, assignedTo, page = 1, limit = 20 } = params;

    const filter: Filter<IncidentDoc> = {};

    if (search) {
      filter.$or = [
        { description: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
      ];
    }
    if (status) filter.status = status as IncidentStatus;
    if (category) filter.category = category;
    if (districtId) filter.districtId = districtId;
    if (reporterId) filter.reporterId = reporterId;
    if (assignedTo) filter.assignedTo = assignedTo;

    const [total, docs] = await Promise.all([
      this.collection.countDocuments(filter),
      this.collection
        .find(filter)
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
    ]);

    return { data: docs.map(this.toIncident), total, page, limit };
  }

  async getIncidentById(id: string): Promise<Incident | null> {
    const doc = await this.collection.findOne({ _id: id });
    return doc ? this.toIncident(doc) : null;
  }

  async createIncident(data: Omit<Incident, "id" | "createdAt" | "updatedAt">): Promise<Incident> {
    const now = new Date().toISOString();
    const doc: IncidentDoc = {
      ...data,
      _id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    await this.collection.insertOne(doc);
    return this.toIncident(doc);
  }

  async updateIncident(
    id: string,
    data: Partial<Omit<Incident, "id" | "createdAt" | "updatedAt">>,
  ): Promise<Incident | null> {
    const now = new Date().toISOString();
    const result = await this.collection.findOneAndUpdate(
      { _id: id },
      { $set: { ...data, updatedAt: now } },
      { returnDocument: "after" },
    );
    return result ? this.toIncident(result) : null;
  }

  async deleteIncident(id: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ _id: id });
    return result.deletedCount === 1;
  }

  async getStats(districtId?: string): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byCategory: Record<string, number>;
  }> {
    const match = districtId ? { districtId } : {};
    const [total, byStatus, byCategory] = await Promise.all([
      this.collection.countDocuments(match),
      this.aggregateCount("$status", match),
      this.aggregateCount("$category", match),
    ]);

    return { total, byStatus, byCategory };
  }

  private async aggregateCount(field: string, match: Record<string, unknown>): Promise<Record<string, number>> {
    const pipeline = [];
    if (Object.keys(match).length > 0) pipeline.push({ $match: match });
    pipeline.push({ $group: { _id: field, count: { $sum: 1 } } });
    const docs = await this.collection.aggregate<{ _id: string; count: number }>(pipeline).toArray();
    return docs.reduce<Record<string, number>>((acc, { _id, count }) => {
      if (_id !== null && _id !== undefined) acc[_id] = count;
      return acc;
    }, {});
  }

  private toIncident(doc: IncidentDoc): Incident {
    const { _id, ...rest } = doc;
    return { id: _id, ...rest };
  }
}
