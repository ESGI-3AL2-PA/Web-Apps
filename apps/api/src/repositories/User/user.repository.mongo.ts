import { randomUUID } from "crypto";
import type { Collection, Db, Filter } from "mongodb";
import { USERS_COLLECTION } from "@repo/server-kit";
import type { User } from "../../entities/user.entity.js";
import { escapeRegex } from "../escape-regex.js";
import type { IUserRepository } from "./user.repository.js";

export class MongoUserRepository implements IUserRepository {
  private collection: Collection<Omit<User, "id"> & { _id: string }>;

  constructor(db: Db) {
    this.collection = db.collection(USERS_COLLECTION);
  }

  async ensureIndexes(): Promise<void> {
    // Backs district-scoped list filtering.
    await this.collection.createIndex({ districtId: 1 });
    // One account per email — prevents two users sharing an address via create/update.
    // NOTE: this build throws if the collection already holds duplicate emails; a real
    // deploy must de-dupe existing data first (or build with a collation/partial filter).
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

    const filter: Filter<Omit<User, "id"> & { _id: string }> = {};
    if (search) {
      const safe = escapeRegex(search);
      filter.$or = [
        { firstName: { $regex: safe, $options: "i" } },
        { lastName: { $regex: safe, $options: "i" } },
        { email: { $regex: safe, $options: "i" } },
      ];
    }
    if (districtId) filter.districtId = districtId;
    if (role) filter.role = role as User["role"];

    const [total, docs] = await Promise.all([
      this.collection.countDocuments(filter),
      this.collection
        .find(filter)
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
    ]);

    return { data: docs.map(this.toUser), total, page, limit };
  }

  async getUserById(id: string): Promise<User | null> {
    const doc = await this.collection.findOne({ _id: id });
    return doc ? this.toUser(doc) : null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const doc = await this.collection.findOne({ email });
    return doc ? this.toUser(doc) : null;
  }

  async createUser(data: Omit<User, "id" | "createdAt" | "updatedAt">): Promise<User> {
    const now = new Date().toISOString();
    const doc = { ...data, _id: randomUUID(), createdAt: now, updatedAt: now };
    await this.collection.insertOne(doc);
    return this.toUser(doc);
  }

  async updateUser(id: string, data: Partial<Omit<User, "id" | "createdAt" | "updatedAt">>): Promise<User | null> {
    const result = await this.collection.findOneAndUpdate(
      { _id: id },
      { $set: { ...data, updatedAt: new Date().toISOString() } },
      { returnDocument: "after" },
    );
    return result ? this.toUser(result) : null;
  }

  async setBanned(id: string, banned: boolean): Promise<User | null> {
    const result = await this.collection.findOneAndUpdate(
      { _id: id },
      { $set: { banned, updatedAt: new Date().toISOString() } },
      { returnDocument: "after" },
    );
    return result ? this.toUser(result) : null;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ _id: id });
    return result.deletedCount === 1;
  }

  private toUser(doc: Omit<User, "id"> & { _id: string }): User {
    const { _id, ...rest } = doc;
    return { id: _id, ...rest };
  }
}
