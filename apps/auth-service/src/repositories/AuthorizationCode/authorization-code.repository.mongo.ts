import { randomUUID } from "crypto";
import type { Collection, Db } from "mongodb";
import { toEntity, type WithMongoId } from "@repo/shared";
import type { AuthorizationCode } from "../../entities/authorization-code.entity.js";
import type { IAuthorizationCodeRepository } from "./authorization-code.repository.js";

export class MongoAuthorizationCodeRepository implements IAuthorizationCodeRepository {
  private collection: Collection<WithMongoId<AuthorizationCode>>;

  constructor(db: Db) {
    this.collection = db.collection("authorization_codes");
  }

  // Codes live 60 seconds and are single-use, so rows are dead almost immediately;
  // the TTL index reaps them instead of letting the collection grow without bound.
  // expireAfterSeconds: 0 means "delete once the indexed date has passed". Unique on
  // codeHash so a collision surfaces as a write error rather than an ambiguous claim.
  async ensureIndexes(): Promise<void> {
    await this.collection.createIndex({ expiresAtDate: 1 }, { expireAfterSeconds: 0 });
    await this.collection.createIndex({ codeHash: 1 }, { unique: true });
  }

  async create(data: Omit<AuthorizationCode, "id">): Promise<AuthorizationCode> {
    const doc: WithMongoId<AuthorizationCode> = { ...data, _id: randomUUID() };
    await this.collection.insertOne(doc);
    return toEntity<AuthorizationCode>(doc);
  }

  async claimByCodeHash(codeHash: string): Promise<AuthorizationCode | null> {
    const res = await this.collection.findOneAndUpdate(
      { codeHash, usedAt: null },
      { $set: { usedAt: new Date().toISOString() } },
      { returnDocument: "before" },
    );
    // mongodb <6 returned { value }, >=6 returns the document directly — handle both.
    const doc = (
      res && "value" in res ? (res as { value: unknown }).value : res
    ) as WithMongoId<AuthorizationCode> | null;
    return doc ? toEntity<AuthorizationCode>(doc) : null;
  }
}
