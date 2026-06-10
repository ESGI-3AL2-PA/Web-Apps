import { randomUUID } from "crypto";
import type { Collection, Db } from "mongodb";
import type { AuthToken, AuthTokenType } from "../../entities/auth-token.entity.js";
import type { IAuthTokenRepository } from "./auth-token.repository.js";

type AuthTokenDoc = Omit<AuthToken, "id"> & { _id: string };

export class MongoAuthTokenRepository implements IAuthTokenRepository {
  private collection: Collection<AuthTokenDoc>;

  constructor(db: Db) {
    this.collection = db.collection("auth_tokens");
  }

  async create(data: Omit<AuthToken, "id">): Promise<AuthToken> {
    const doc: AuthTokenDoc = { ...data, _id: randomUUID() };
    await this.collection.insertOne(doc);
    return this.toEntity(doc);
  }

  async findActiveByHash(tokenHash: string, type: AuthTokenType): Promise<AuthToken | null> {
    const doc = await this.collection.findOne({ tokenHash, type, usedAt: null });
    return doc ? this.toEntity(doc) : null;
  }

  async markUsed(id: string): Promise<void> {
    await this.collection.updateOne({ _id: id }, { $set: { usedAt: new Date().toISOString() } });
  }

  async revokeAllForUser(userId: string, type: AuthTokenType): Promise<void> {
    await this.collection.updateMany({ userId, type, usedAt: null }, { $set: { usedAt: new Date().toISOString() } });
  }

  private toEntity(doc: AuthTokenDoc): AuthToken {
    const { _id, ...rest } = doc;
    return { id: _id, ...rest };
  }
}
