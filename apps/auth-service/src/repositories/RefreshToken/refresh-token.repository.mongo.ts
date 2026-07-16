import { randomUUID } from "crypto";
import type { Collection, Db } from "mongodb";
import { toEntity, type WithMongoId } from "@repo/server-kit";
import type { RefreshToken } from "../../entities/refresh-token.entity.js";
import type { IRefreshTokenRepository } from "./refresh-token.repository.js";

export class MongoRefreshTokenRepository implements IRefreshTokenRepository {
  private collection: Collection<WithMongoId<RefreshToken>>;

  constructor(db: Db) {
    this.collection = db.collection("refresh_tokens");
  }

  // TTL index so expired (and revoked-but-expired) rows self-purge, bounding how
  // long a session's IP/User-Agent history is retained. expireAfterSeconds: 0 means
  // "delete once the indexed date has passed". Indexes the BSON `expiresAtDate` Date
  // field — the TTL monitor ignores the ISO-string `expiresAt`. Only tokens created
  // after this deploy carry the Date, so the TTL is forward-looking. Idempotent:
  // createIndex is a no-op if an identical index already exists.
  async ensureIndexes(): Promise<void> {
    await this.collection.createIndex({ expiresAtDate: 1 }, { expireAfterSeconds: 0 });
  }

  // One-time backfill for storage-limitation (GDPR Art. 5(1)(e), finding gdpr-H3):
  // rows created before `expiresAtDate` existed have no BSON Date, so the TTL index
  // never touches them and their IP/User-Agent history is retained indefinitely.
  // Set `expiresAtDate` = createdAt + the same 7-day window issue-tokens.ts applies, so
  // legacy sessions expire consistently with policy rather than surprisingly-immediately.
  // Idempotent: `{ expiresAtDate: null }` matches both missing and null fields and is a
  // cheap index-backed no-op once every row has been backfilled. Run after ensureIndexes.
  async backfillMissingExpiresAtDate(): Promise<number> {
    const result = await this.collection.updateMany({ expiresAtDate: null }, [
      {
        $set: {
          expiresAtDate: { $dateAdd: { startDate: { $toDate: "$createdAt" }, unit: "day", amount: 7 } },
        },
      },
    ]);
    return result.modifiedCount;
  }

  async create(data: Omit<RefreshToken, "id">): Promise<RefreshToken> {
    const doc = { ...data, _id: randomUUID() };
    await this.collection.insertOne(doc);
    return toEntity<RefreshToken>(doc);
  }

  async findActiveByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
    const doc = await this.collection.findOne({ tokenHash, revokedAt: null });
    return doc ? toEntity<RefreshToken>(doc) : null;
  }

  async claimByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
    const res = await this.collection.findOneAndUpdate(
      { tokenHash, revokedAt: null },
      { $set: { revokedAt: new Date().toISOString() } },
      { returnDocument: "before" },
    );
    // mongodb <6 returned { value }, >=6 returns the document directly — handle both.
    const doc = (res && "value" in res ? (res as { value: unknown }).value : res) as WithMongoId<RefreshToken> | null;
    return doc ? toEntity<RefreshToken>(doc) : null;
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
    const doc = await this.collection.findOne({ tokenHash });
    return doc ? toEntity<RefreshToken>(doc) : null;
  }

  async findActiveByUserId(userId: string): Promise<RefreshToken[]> {
    const now = new Date().toISOString();
    const docs = await this.collection
      .find({ userId, revokedAt: null, expiresAt: { $gt: now } })
      .sort({ lastUsedAt: -1, createdAt: -1 })
      .toArray();
    return docs.map((d) => toEntity<RefreshToken>(d));
  }

  async listAllForUser(userId: string): Promise<RefreshToken[]> {
    const docs = await this.collection.find({ userId }).sort({ createdAt: -1 }).toArray();
    return docs.map((d) => toEntity<RefreshToken>(d));
  }

  async revokeById(id: string, userId: string): Promise<boolean> {
    const result = await this.collection.updateOne(
      { _id: id, userId, revokedAt: null },
      { $set: { revokedAt: new Date().toISOString() } },
    );
    return result.modifiedCount === 1;
  }

  async revokeBySessionId(sessionId: string, userId?: string): Promise<boolean> {
    // Match by family id, or by token _id as a fallback so sessions created before
    // the sessionId field existed (null family) are still revocable by their id.
    const filter = {
      $or: [{ sessionId }, { _id: sessionId }],
      revokedAt: null,
      ...(userId ? { userId } : {}),
    };
    const result = await this.collection.updateMany(filter, { $set: { revokedAt: new Date().toISOString() } });
    return result.modifiedCount > 0;
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

  async deleteAllForUser(userId: string): Promise<void> {
    await this.collection.deleteMany({ userId });
  }
}
