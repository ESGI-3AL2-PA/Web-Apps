import { randomUUID } from "crypto";
import type { Collection, Db, Filter, UpdateFilter } from "mongodb";
import { toEntity, type WithMongoId } from "@repo/shared";
import { DistrictSchema, type District, type GeoJson } from "../../entities/district.entity.js";
import { escapeRegex } from "../escape-regex.js";
import type { IDistrictRepository, UpdateDistrictData } from "./district.repository.js";

type DistrictDoc = WithMongoId<District>;

// Parse through the schema so legacy docs predating startingPoints/status read back
// with their defaults (startingPoints: 0, status: "active") applied.
const toDistrict = (doc: DistrictDoc): District => DistrictSchema.parse(toEntity<District>(doc));

export class MongoDistrictRepository implements IDistrictRepository {
  private collection: Collection<DistrictDoc>;

  constructor(db: Db) {
    this.collection = db.collection("districts");
  }

  async ensureIndexes(): Promise<void> {
    // Backs $geoIntersects lookups; districts must store geoJson as valid GeoJSON geometry.
    await this.collection.createIndex({ geoJson: "2dsphere" });
  }

  async findDistrictsContaining(point: GeoJson): Promise<District[]> {
    const docs = await this.collection
      .find({ geoJson: { $geoIntersects: { $geometry: point } } } as Filter<DistrictDoc>)
      .toArray();
    return docs.map(toDistrict);
  }

  async getDistricts(params: { search?: string; page?: number; limit?: number }): Promise<{
    data: District[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { search, page = 1, limit = 20 } = params;

    const filter: Filter<DistrictDoc> = {};
    if (search) filter.name = { $regex: escapeRegex(search), $options: "i" };

    const [total, docs] = await Promise.all([
      this.collection.countDocuments(filter),
      this.collection
        .find(filter)
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
    ]);

    return { data: docs.map(toDistrict), total, page, limit };
  }

  async getDistrictById(id: string): Promise<District | null> {
    const doc = await this.collection.findOne({ _id: id });
    return doc ? toDistrict(doc) : null;
  }

  async createDistrict(data: Omit<District, "id">): Promise<District> {
    const doc: DistrictDoc = { ...data, _id: randomUUID() };
    await this.collection.insertOne(doc);
    return toDistrict(doc);
  }

  async updateDistrict(id: string, data: UpdateDistrictData): Promise<District | null> {
    // geoJson: null means "clear the boundary" — $unset it rather than $set null, since the
    // 2dsphere index rejects a literal null value but tolerates the field being absent.
    const { geoJson, ...rest } = data;
    const update: UpdateFilter<DistrictDoc> = { $set: { ...rest, ...(geoJson ? { geoJson } : {}) } };
    if (geoJson === null) {
      update.$unset = { geoJson: "" };
    }

    const result = await this.collection.findOneAndUpdate({ _id: id }, update, { returnDocument: "after" });
    return result ? toDistrict(result) : null;
  }

  async deleteDistrict(id: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ _id: id });
    return result.deletedCount === 1;
  }
}
