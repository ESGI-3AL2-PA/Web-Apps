import type { Collection, Db } from "mongodb";
import { USERS_COLLECTION, type WithMongoId } from "@repo/server-kit";
import type { IUserReaderRepository, UserRecord } from "./user-reader.repository.js";

type UserDoc = WithMongoId<UserRecord>;

export class MongoUserReaderRepository implements IUserReaderRepository {
  private collection: Collection<UserDoc>;

  constructor(db: Db) {
    this.collection = db.collection(USERS_COLLECTION);
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const doc = await this.collection.findOne({ email });
    return doc ? this.toEntity(doc) : null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const doc = await this.collection.findOne({ _id: id });
    return doc ? this.toEntity(doc) : null;
  }

  async setEmailVerified(userId: string): Promise<void> {
    await this.collection.updateOne(
      { _id: userId },
      { $set: { emailVerified: true, updatedAt: new Date().toISOString() } },
    );
  }

  async setPasswordHash(userId: string, passwordHash: string): Promise<void> {
    await this.collection.updateOne({ _id: userId }, { $set: { passwordHash, updatedAt: new Date().toISOString() } });
  }

  async setTotpSecret(userId: string, secret: string | null, enabled: boolean): Promise<void> {
    await this.collection.updateOne(
      { _id: userId },
      { $set: { totpSecret: secret, totpEnabled: enabled, updatedAt: new Date().toISOString() } },
    );
  }

  async consumeTotpStep(userId: string, step: number): Promise<boolean> {
    // The $or guard makes the update match only when this step is strictly newer than the last
    // one consumed (or none has been), so replaying a code resolves to modifiedCount 0.
    const res = await this.collection.updateOne(
      { _id: userId, $or: [{ lastTotpStep: { $exists: false } }, { lastTotpStep: { $lt: step } }] },
      { $set: { lastTotpStep: step, updatedAt: new Date().toISOString() } },
    );
    return res.modifiedCount === 1;
  }

  private toEntity(doc: UserDoc): UserRecord {
    const { _id, ...rest } = doc;
    return { id: _id, ...rest };
  }
}
