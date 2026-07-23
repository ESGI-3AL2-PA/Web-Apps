import { randomUUID } from "crypto";
import type { Collection, Db, Filter, UpdateFilter } from "mongodb";
import { toEntity, type WithMongoId } from "@repo/shared";
import { DistrictSchema, type District, type GeoJson } from "../../entities/district.entity.js";
import { escapeRegex } from "../escape-regex.js";
import type { IDistrictRepository, UpdateDistrictData } from "./district.repository.js";

type DistrictDoc = WithMongoId<District>;

// On passe par le schéma zod pour que les vieux documents antérieurs aux champs
// startingPoints/status soient relus avec leurs valeurs par défaut appliquées
// (startingPoints: 0, status: "active").
const toDistrict = (doc: DistrictDoc): District => DistrictSchema.parse(toEntity<District>(doc));

/**
 * Implémentation Mongo du repository des quartiers.
 *
 * Persiste la collection `districts` avec un index géospatial 2dsphere sur la
 * frontière GeoJSON.
 */
export class MongoDistrictRepository implements IDistrictRepository {
  private collection: Collection<DistrictDoc>;

  constructor(db: Db) {
    this.collection = db.collection("districts");
  }

  async ensureIndexes(): Promise<void> {
    // Sous-tend les recherches $geoIntersects ; les quartiers doivent stocker geoJson
    // comme une géométrie GeoJSON valide.
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
    // geoJson: null signifie "effacer la frontière" — on le $unset plutôt que de le
    // $set à null, car l'index 2dsphere rejette une valeur null littérale mais
    // tolère l'absence du champ.
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
