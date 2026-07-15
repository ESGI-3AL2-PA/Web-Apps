import { randomUUID } from "crypto";
import type { Collection, Db, Filter } from "mongodb";
import type { Tag } from "../../entities/tag.entity.js";
import { escapeRegex } from "../escape-regex.js";
import type { ITagRepository } from "./tag.repository.js";

// Stored shape tolerates legacy docs written before per-language labels existed
// (label absent, description a plain string); toTag normalizes them on read.
type StoredTag = Omit<Tag, "id" | "label" | "description"> & {
  label?: Tag["label"];
  description?: Tag["description"] | string;
};
type TagDoc = StoredTag & { _id: string };

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
      const safe = escapeRegex(search);
      const rx = { $regex: safe, $options: "i" };
      filter.$or = [
        { name: rx },
        { "label.fr": rx },
        { "label.en": rx },
        { "description.fr": rx },
        { "description.en": rx },
      ] as Filter<TagDoc>["$or"];
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
    const { _id, label, description, ...rest } = doc;
    return {
      id: _id,
      ...rest,
      // Legacy docs may predate per-language fields — fall back so responses stay valid.
      label: label ?? { fr: doc.name, en: doc.name },
      description: typeof description === "string" ? { fr: description, en: description } : description,
    };
  }
}
