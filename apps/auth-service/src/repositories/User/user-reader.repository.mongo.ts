import type { Collection, Db } from "mongodb";
import { USERS_COLLECTION, toEntity, type WithMongoId } from "@repo/shared";
import type { IUserReaderRepository, UserRecord } from "./user-reader.repository.js";

type UserDoc = WithMongoId<UserRecord>;

/**
 * Implémentation Mongo de IUserReaderRepository (collection `users`, partagée avec l'api).
 * Lit les utilisateurs pour l'authentification et écrit les seuls champs liés à l'auth
 * (email vérifié, hash de mot de passe, secret TOTP, dernier pas TOTP consommé).
 */
export class MongoUserReaderRepository implements IUserReaderRepository {
  private collection: Collection<UserDoc>;

  constructor(db: Db) {
    this.collection = db.collection(USERS_COLLECTION);
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const doc = await this.collection.findOne({ email });
    return doc ? toEntity<UserRecord>(doc) : null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const doc = await this.collection.findOne({ _id: id });
    return doc ? toEntity<UserRecord>(doc) : null;
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
    // Le garde $or ne fait matcher l'update que si ce pas est strictement plus récent que le
    // dernier consommé (ou qu'aucun ne l'a été), si bien que rejouer un code donne modifiedCount 0.
    const res = await this.collection.updateOne(
      { _id: userId, $or: [{ lastTotpStep: { $exists: false } }, { lastTotpStep: { $lt: step } }] },
      { $set: { lastTotpStep: step, updatedAt: new Date().toISOString() } },
    );
    return res.modifiedCount === 1;
  }
}
