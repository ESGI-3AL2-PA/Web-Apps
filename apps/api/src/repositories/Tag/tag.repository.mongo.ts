import { randomUUID } from "crypto";
import type { Collection, Db, Filter } from "mongodb";
import type { Tag } from "../../entities/tag.entity.js";
import type { ITagRepository } from "./tag.repository.js";

type TagDoc = Omit<Tag, "id"> & { _id: string };

export class MongoTagRepository implements ITagRepository {
  private collection: Collection<TagDoc>;

  constructor(db: Db) {
    this.collection = db.collection("tags");
  }

  async ensureIndexes(): Promise<void> {
    // Backs district-scoped list filtering and the per-district name dedupe in getTagsByNames.
    await this.collection.createIndex({ districtId: 1, name: 1 });
  }

  async getTags(params: { search?: string; districtId?: string; page?: number; limit?: number }): Promise<{
    data: Tag[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { search, districtId, page = 1, limit = 20 } = params;

    const filter: Filter<TagDoc> = {};
    if (search) {
      filter.$or = [{ name: { $regex: search, $options: "i" } }, { description: { $regex: search, $options: "i" } }];
    }
    if (districtId) filter.districtId = districtId;

    const [total, docs] = await Promise.all([
      this.collection.countDocuments(filter),
      this.collection
        .find(filter)
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
    ]);

    return { data: docs.map(this.toTag), total, page, limit };
  }

  async getTagById(id: string): Promise<Tag | null> {
    const doc = await this.collection.findOne({ _id: id });
    return doc ? this.toTag(doc) : null;
  }

  async getTagsByNames(districtId: string, names: string[]): Promise<Tag[]> {
    if (names.length === 0) return [];
    const docs = await this.collection.find({ districtId, name: { $in: names } }).toArray();
    return docs.map(this.toTag);
  }

  async createTag(data: Omit<Tag, "id">): Promise<Tag> {
    const doc: TagDoc = { ...data, _id: randomUUID() };
    await this.collection.insertOne(doc);
    return this.toTag(doc);
  }

  async updateTag(id: string, data: Partial<Omit<Tag, "id">>): Promise<Tag | null> {
    const result = await this.collection.findOneAndUpdate(
      { _id: id },
      { $set: { ...data } },
      { returnDocument: "after" },
    );
    return result ? this.toTag(result) : null;
  }

  async deleteTag(id: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ _id: id });
    return result.deletedCount === 1;
  }

  private toTag(doc: TagDoc): Tag {
    const { _id, ...rest } = doc;
    return { id: _id, ...rest };
  }
}
