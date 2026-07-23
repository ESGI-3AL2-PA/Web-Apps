import { randomUUID } from "crypto";
import type { Collection, Db, Filter } from "mongodb";
import { USERS_COLLECTION, toEntity, type WithMongoId } from "@repo/shared";
import type { User } from "../../entities/user.entity.js";
import { escapeRegex } from "../escape-regex.js";
import type { IUserRepository } from "./user.repository.js";

/**
 * Implémentation Mongo du repository des utilisateurs (couche repository).
 *
 * Opère sur la collection `users`. Convertit les documents Mongo (`_id`) en
 * entités du domaine (`id`) via `toEntity`, échappe les recherches texte avant
 * de les injecter dans un `$regex`.
 */
export class MongoUserRepository implements IUserRepository {
  private collection: Collection<WithMongoId<User>>;

  constructor(db: Db) {
    this.collection = db.collection(USERS_COLLECTION);
  }

  async ensureIndexes(): Promise<void> {
    // Soutient le filtrage des listes par quartier.
    await this.collection.createIndex({ districtId: 1 });
    // Un seul compte par email — empêche deux utilisateurs de partager une adresse via create/update.
    // NOTE : ce build lève une erreur si la collection contient déjà des emails en double ; un vrai
    // déploiement doit d'abord dédupliquer les données existantes (ou construire l'index avec une collation / un filtre partiel).
    await this.collection.createIndex({ email: 1 }, { unique: true });
  }

  async getUsers(params: {
    search?: string;
    districtId?: string;
    role?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    data: User[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { search, districtId, role, page = 1, limit = 10 } = params;

    const filter: Filter<WithMongoId<User>> = {};
    if (search) {
      // Échappe la chaîne avant de l'utiliser dans un $regex (évite l'injection de regex / déni de service).
      const safe = escapeRegex(search);
      filter.$or = [
        { firstName: { $regex: safe, $options: "i" } },
        { lastName: { $regex: safe, $options: "i" } },
        { email: { $regex: safe, $options: "i" } },
      ];
    }
    if (districtId) filter.districtId = districtId;
    if (role) filter.role = role as User["role"];

    // Compte total et page de documents récupérés en parallèle.
    const [total, docs] = await Promise.all([
      this.collection.countDocuments(filter),
      this.collection
        .find(filter)
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
    ]);

    return { data: docs.map((d) => toEntity<User>(d)), total, page, limit };
  }

  async getUserById(id: string): Promise<User | null> {
    const doc = await this.collection.findOne({ _id: id });
    return doc ? toEntity<User>(doc) : null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const doc = await this.collection.findOne({ email });
    return doc ? toEntity<User>(doc) : null;
  }

  async findUsersByDistrict(districtId: string): Promise<User[]> {
    const docs = await this.collection.find({ districtId }).toArray();
    return docs.map((d) => toEntity<User>(d));
  }

  async createUser(data: Omit<User, "id" | "createdAt" | "updatedAt">): Promise<User> {
    const now = new Date().toISOString();
    const doc = { ...data, _id: randomUUID(), createdAt: now, updatedAt: now };
    await this.collection.insertOne(doc);
    return toEntity<User>(doc);
  }

  async updateUser(id: string, data: Partial<Omit<User, "id" | "createdAt" | "updatedAt">>): Promise<User | null> {
    const result = await this.collection.findOneAndUpdate(
      { _id: id },
      { $set: { ...data, updatedAt: new Date().toISOString() } },
      { returnDocument: "after" },
    );
    return result ? toEntity<User>(result) : null;
  }

  async setBanned(id: string, banned: boolean): Promise<User | null> {
    const result = await this.collection.findOneAndUpdate(
      { _id: id },
      { $set: { banned, updatedAt: new Date().toISOString() } },
      { returnDocument: "after" },
    );
    return result ? toEntity<User>(result) : null;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ _id: id });
    return result.deletedCount === 1;
  }
}
