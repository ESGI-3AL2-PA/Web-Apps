/**
 * Repository (implémentation Mongo) des tags de la collection `tags`.
 *
 * CRUD des tags avec listage paginé + recherche (nom et libellés/descriptions
 * multilingues), le tout filtrable par quartier. Normalise à la lecture les
 * documents hérités qui précèdent l'ajout des champs par langue.
 */
import { randomUUID } from "crypto";
import type { Collection, Db, Filter } from "mongodb";
import type { Tag } from "../../entities/tag.entity.js";
import { escapeRegex } from "../escape-regex.js";
import type { ITagRepository } from "./tag.repository.js";

// La forme stockée tolère les documents hérités écrits avant l'existence des libellés
// par langue (label absent, description en simple chaîne) ; toTag les normalise à la lecture.
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
    // Soutient le filtrage du listage par quartier et la déduplication par nom (par quartier) de getTagsByNames.
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
      // escapeRegex neutralise les métacaractères pour une recherche insensible à la casse sûre.
      const safe = escapeRegex(search);
      const rx = { $regex: safe, $options: "i" };
      // Recherche sur le nom brut + les libellés/descriptions FR et EN.
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

  /** Résout un lot de tags par leurs noms au sein d'un quartier (utilisé au rattachement de tags). */
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

  // Mappe un document Mongo vers l'entité Tag, en normalisant les documents hérités.
  private toTag(doc: TagDoc): Tag {
    const { _id, label, description, ...rest } = doc;
    return {
      id: _id,
      ...rest,
      // Les documents hérités peuvent précéder les champs par langue — repli pour garder des réponses valides.
      label: label ?? { fr: doc.name, en: doc.name },
      description: typeof description === "string" ? { fr: description, en: description } : description,
    };
  }
}
