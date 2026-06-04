import { randomUUID } from "crypto";
import type { Collection, Db } from "mongodb";
import type { RefreshToken } from "../../entities/refresh-token.entity.js";
import type { IRefreshTokenRepository } from "./refresh-token.repository.js";

export class MongoRefreshTokenRepository implements IRefreshTokenRepository {
  private collection: Collection<Omit<RefreshToken, "id"> & { _id: string }>;

  constructor(db: Db) {
    this.collection = db.collection("refresh_tokens");
  }

  async create(data: Omit<RefreshToken, "id">): Promise<RefreshToken> {
    const doc = { ...data, _id: randomUUID() };
    await this.collection.insertOne(doc);
    return this.toEntity(doc);
  }

  async findActiveByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
    const doc = await this.collection.findOne({ tokenHash, revokedAt: null });
    return doc ? this.toEntity(doc) : null;
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
    const doc = await this.collection.findOne({ tokenHash });
    return doc ? this.toEntity(doc) : null;
  }

  async revokeByTokenHash(tokenHash: string): Promise<boolean> {
    const result = await this.collection.updateOne(
      { tokenHash, revokedAt: null },
      { $set: { revokedAt: new Date().toISOString() } },
    );
    return result.modifiedCount === 1;
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.collection.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date().toISOString() } });
  }

  private toEntity(doc: Omit<RefreshToken, "id"> & { _id: string }): RefreshToken {
    const { _id, ...rest } = doc;
    return { id: _id, ...rest };
  }
}
