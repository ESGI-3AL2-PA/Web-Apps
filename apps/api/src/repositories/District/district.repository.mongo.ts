import { randomUUID } from "crypto";
import type { Collection, Db, Filter } from "mongodb";
import type { District, GeoJson } from "../../entities/district.entity.js";
import type { IDistrictRepository } from "./district.repository.js";

type DistrictDoc = Omit<District, "id"> & { _id: string };

export class MongoDistrictRepository implements IDistrictRepository {
  private collection: Collection<DistrictDoc>;

  constructor(db: Db) {
    this.collection = db.collection("districts");
  }

  async ensureIndexes(): Promise<void> {
    // Backs $geoIntersects lookups; districts must store geoJson as valid GeoJSON geometry.
    await this.collection.createIndex({ geoJson: "2dsphere" });
  }

  async findDistrictContaining(point: GeoJson): Promise<District | null> {
    const doc = await this.collection.findOne({
      geoJson: { $geoIntersects: { $geometry: point } },
    } as Filter<DistrictDoc>);
    return doc ? this.toDistrict(doc) : null;
  }

  async getDistricts(params: { search?: string; page?: number; limit?: number }): Promise<{
    data: District[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { search, page = 1, limit = 20 } = params;

    const filter: Filter<DistrictDoc> = {};
    if (search) filter.name = { $regex: search, $options: "i" };

    const [total, docs] = await Promise.all([
      this.collection.countDocuments(filter),
      this.collection
        .find(filter)
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
    ]);

    return { data: docs.map(this.toDistrict), total, page, limit };
  }

  async getDistrictById(id: string): Promise<District | null> {
    const doc = await this.collection.findOne({ _id: id });
    return doc ? this.toDistrict(doc) : null;
  }

  async createDistrict(data: Omit<District, "id">): Promise<District> {
    const doc: DistrictDoc = { ...data, _id: randomUUID() };
    await this.collection.insertOne(doc);
    return this.toDistrict(doc);
  }

  async updateDistrict(id: string, data: Partial<Omit<District, "id">>): Promise<District | null> {
    const result = await this.collection.findOneAndUpdate(
      { _id: id },
      { $set: { ...data } },
      { returnDocument: "after" },
    );
    return result ? this.toDistrict(result) : null;
  }

  async deleteDistrict(id: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ _id: id });
    return result.deletedCount === 1;
  }

  private toDistrict(doc: DistrictDoc): District {
    const { _id, ...rest } = doc;
    return { id: _id, ...rest };
  }
}
