import { randomUUID } from "crypto";
import type { Collection, Db, Filter } from "mongodb";
import { DISTRICT_ADMINS_COLLECTION, type WithMongoId } from "@repo/server-kit";
import type { DistrictAdmin } from "../../entities/district-admin.entity.js";
import type { IDistrictAdminRepository } from "./district-admin.repository.js";

type DistrictAdminDoc = WithMongoId<DistrictAdmin>;

export class MongoDistrictAdminRepository implements IDistrictAdminRepository {
  private collection: Collection<DistrictAdminDoc>;

  constructor(db: Db) {
    this.collection = db.collection(DISTRICT_ADMINS_COLLECTION);
  }

  async listDistrictAdmins(params: { districtId?: string; userId?: string; page?: number; limit?: number }) {
    const { districtId, userId, page = 1, limit = 20 } = params;
    const filter: Filter<DistrictAdminDoc> = {};
    if (districtId) filter.districtId = districtId;
    if (userId) filter.userId = userId;

    const [total, docs] = await Promise.all([
      this.collection.countDocuments(filter),
      this.collection
        .find(filter)
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
    ]);

    return { data: docs.map(this.toEntity), total, page, limit };
  }

  async getDistrictAdminById(id: string): Promise<DistrictAdmin | null> {
    const doc = await this.collection.findOne({ _id: id });
    return doc ? this.toEntity(doc) : null;
  }

  async findExisting(districtId: string, userId: string): Promise<DistrictAdmin | null> {
    const doc = await this.collection.findOne({ districtId, userId });
    return doc ? this.toEntity(doc) : null;
  }

  async createDistrictAdmin(data: Omit<DistrictAdmin, "id" | "createdAt">): Promise<DistrictAdmin> {
    const doc: DistrictAdminDoc = {
      _id: randomUUID(),
      ...data,
      createdAt: new Date().toISOString(),
    };
    await this.collection.insertOne(doc);
    return this.toEntity(doc);
  }

  async deleteDistrictAdmin(id: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ _id: id });
    return result.deletedCount === 1;
  }

  async ensureIndexes(): Promise<void> {
    // Unique compound index — one user can only be admin once per district.
    await this.collection.createIndex({ districtId: 1, userId: 1 }, { unique: true });
  }

  private toEntity(doc: DistrictAdminDoc): DistrictAdmin {
    const { _id, ...rest } = doc;
    return { id: _id, ...rest };
  }
}
