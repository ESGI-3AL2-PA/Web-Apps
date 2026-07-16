import { randomUUID } from "crypto";
import type { Collection, Db } from "mongodb";
import { toEntity, type WithMongoId } from "@repo/server-kit";
import type { AuthToken, AuthTokenType } from "../../entities/auth-token.entity.js";
import type { IAuthTokenRepository } from "./auth-token.repository.js";

type AuthTokenDoc = WithMongoId<AuthToken>;

export class MongoAuthTokenRepository implements IAuthTokenRepository {
  private collection: Collection<AuthTokenDoc>;

  constructor(db: Db) {
    this.collection = db.collection("auth_tokens");
  }

  async create(data: Omit<AuthToken, "id">): Promise<AuthToken> {
    const doc: AuthTokenDoc = { ...data, _id: randomUUID() };
    await this.collection.insertOne(doc);
    return toEntity<AuthToken>(doc);
  }

  async findActiveByHash(tokenHash: string, type: AuthTokenType): Promise<AuthToken | null> {
    const doc = await this.collection.findOne({ tokenHash, type, usedAt: null });
    return doc ? toEntity<AuthToken>(doc) : null;
  }

  async markUsed(id: string): Promise<void> {
    await this.collection.updateOne({ _id: id }, { $set: { usedAt: new Date().toISOString() } });
  }

  async revokeAllForUser(userId: string, type: AuthTokenType): Promise<void> {
    await this.collection.updateMany({ userId, type, usedAt: null }, { $set: { usedAt: new Date().toISOString() } });
  }
}
