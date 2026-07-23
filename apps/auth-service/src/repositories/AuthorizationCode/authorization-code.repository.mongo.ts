import { randomUUID } from "crypto";
import type { Collection, Db } from "mongodb";
import { toEntity, type WithMongoId } from "@repo/shared";
import type { AuthorizationCode } from "../../entities/authorization-code.entity.js";
import type { IAuthorizationCodeRepository } from "./authorization-code.repository.js";

/**
 * Implémentation Mongo de IAuthorizationCodeRepository (collection `authorization_codes`).
 * Stocke les codes d'autorisation OAuth à usage unique et courte durée de vie.
 */
export class MongoAuthorizationCodeRepository implements IAuthorizationCodeRepository {
  private collection: Collection<WithMongoId<AuthorizationCode>>;

  constructor(db: Db) {
    this.collection = db.collection("authorization_codes");
  }

  // Les codes vivent 60 secondes et sont à usage unique : les documents sont morts presque
  // immédiatement. L'index TTL les récupère plutôt que de laisser la collection grossir sans
  // limite. expireAfterSeconds: 0 signifie « supprimer dès que la date indexée est passée ».
  // Index unique sur codeHash pour qu'une collision remonte en erreur d'écriture plutôt qu'en
  // réclamation ambiguë.
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
    // Compare-and-swap : ne matche que si usedAt est null, et le passe à « maintenant » dans
    // la même opération atomique. `before` retourne le document tel qu'avant marquage.
    const res = await this.collection.findOneAndUpdate(
      { codeHash, usedAt: null },
      { $set: { usedAt: new Date().toISOString() } },
      { returnDocument: "before" },
    );
    // mongodb <6 renvoyait { value }, >=6 renvoie le document directement — on gère les deux.
    const doc = (
      res && "value" in res ? (res as { value: unknown }).value : res
    ) as WithMongoId<AuthorizationCode> | null;
    return doc ? toEntity<AuthorizationCode>(doc) : null;
  }
}
