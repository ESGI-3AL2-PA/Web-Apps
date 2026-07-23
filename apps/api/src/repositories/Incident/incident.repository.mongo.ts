import { randomUUID } from "crypto";
import type { Collection, Db, Filter } from "mongodb";
import { toEntity, type WithMongoId } from "@repo/shared";
import type { Incident, IncidentStatus } from "../../entities/incident.entity.js";
import { escapeRegex } from "../escape-regex.js";
import type { IIncidentRepository } from "./incident.repository.js";

// Document Mongo = entité Incident + son `_id` (id métier stocké tel quel).
type IncidentDoc = WithMongoId<Incident>;

/**
 * Implémentation Mongo du repository des signalements (collection `incidents`).
 * Recherche plein-texte par regex, filtres cumulables, pagination skip/limit
 * et agrégations de stats par statut / catégorie.
 */
export class MongoIncidentRepository implements IIncidentRepository {
  private collection: Collection<IncidentDoc>;

  constructor(db: Db) {
    this.collection = db.collection("incidents");
  }

  async ensureIndexes(): Promise<void> {
    // Index qui sert au filtrage des listes par quartier.
    await this.collection.createIndex({ districtId: 1 });
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

    // Recherche insensible à la casse sur description + catégorie ; on échappe
    // les métacaractères regex de la saisie pour éviter toute injection.
    if (search) {
      const safe = escapeRegex(search);
      filter.$or = [{ description: { $regex: safe, $options: "i" } }, { category: { $regex: safe, $options: "i" } }];
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

    return { data: docs.map((d) => toEntity<Incident>(d)), total, page, limit };
  }

  async getIncidentById(id: string): Promise<Incident | null> {
    const doc = await this.collection.findOne({ _id: id });
    return doc ? toEntity<Incident>(doc) : null;
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
    return toEntity<Incident>(doc);
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
    return result ? toEntity<Incident>(result) : null;
  }

  async deleteIncident(id: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ _id: id });
    return result.deletedCount === 1;
  }

  async getStats(params?: { districtId?: string; reporterId?: string }): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byCategory: Record<string, number>;
  }> {
    const match: Record<string, unknown> = {};
    if (params?.districtId) match.districtId = params.districtId;
    if (params?.reporterId) match.reporterId = params.reporterId;
    const [total, byStatus, byCategory] = await Promise.all([
      this.collection.countDocuments(match),
      this.aggregateCount("$status", match),
      this.aggregateCount("$category", match),
    ]);

    return { total, byStatus, byCategory };
  }

  // Agrège un $group + compte par valeur du champ donné (ex. "$status"),
  // renvoyé sous forme de map { valeur: nombre }. Les buckets null/undefined
  // sont ignorés.
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

  // Supprime tous les signalements d'un rapporteur (suppression de compte).
  async deleteByReporter(reporterId: string): Promise<void> {
    await this.collection.deleteMany({ reporterId });
  }
}
