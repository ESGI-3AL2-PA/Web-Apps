import { randomUUID } from "crypto";
import type { Collection, Db } from "mongodb";
import { toEntity, type WithMongoId } from "@repo/shared";
import type { RefreshToken } from "../../entities/refresh-token.entity.js";
import type { IRefreshTokenRepository } from "./refresh-token.repository.js";

/**
 * Implémentation Mongo de IRefreshTokenRepository (collection `refresh_tokens`).
 * Gère le cycle de vie des sessions : création, rotation atomique, révocation ciblée ou en
 * masse, purge TTL et opérations RGPD.
 */
export class MongoRefreshTokenRepository implements IRefreshTokenRepository {
  private collection: Collection<WithMongoId<RefreshToken>>;

  constructor(db: Db) {
    this.collection = db.collection("refresh_tokens");
  }

  // Index TTL pour que les lignes expirées (et révoquées-mais-expirées) s'auto-purgent, ce
  // qui borne la durée de conservation de l'historique IP/User-Agent d'une session.
  // expireAfterSeconds: 0 signifie « supprimer dès que la date indexée est passée ». Indexe
  // le champ BSON Date `expiresAtDate` — le moniteur TTL ignore la chaîne ISO `expiresAt`.
  // Seuls les tokens créés après ce déploiement portent la Date, donc le TTL n'agit que vers
  // l'avenir. Idempotent : createIndex est un no-op si un index identique existe déjà.
  async ensureIndexes(): Promise<void> {
    await this.collection.createIndex({ expiresAtDate: 1 }, { expireAfterSeconds: 0 });
  }

  // Backfill ponctuel pour la limitation de conservation (RGPD Art. 5(1)(e), finding gdpr-H3) :
  // les lignes créées avant l'existence de `expiresAtDate` n'ont pas de Date BSON, donc l'index
  // TTL ne les touche jamais et leur historique IP/User-Agent est conservé indéfiniment.
  // On pose `expiresAtDate` = createdAt + la même fenêtre de 7 jours qu'applique issue-tokens.ts,
  // pour que les anciennes sessions expirent conformément à la politique plutôt que de disparaître
  // brutalement tout de suite. Idempotent : `{ expiresAtDate: null }` matche à la fois le champ
  // manquant et null, et devient un no-op bon marché adossé à l'index une fois toutes les lignes
  // rattrapées. À exécuter après ensureIndexes.
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
    // Compare-and-swap : révoque le token seulement s'il est encore actif, atomiquement.
    const res = await this.collection.findOneAndUpdate(
      { tokenHash, revokedAt: null },
      { $set: { revokedAt: new Date().toISOString() } },
      { returnDocument: "before" },
    );
    // mongodb <6 renvoyait { value }, >=6 renvoie le document directement — on gère les deux.
    const doc = (res && "value" in res ? (res as { value: unknown }).value : res) as WithMongoId<RefreshToken> | null;
    return doc ? toEntity<RefreshToken>(doc) : null;
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
    const doc = await this.collection.findOne({ tokenHash });
    return doc ? toEntity<RefreshToken>(doc) : null;
  }

  async findActiveByUserId(userId: string): Promise<RefreshToken[]> {
    const now = new Date().toISOString();
    // Actives = non révoquées et pas encore expirées ; triées de la plus récemment utilisée
    // à la plus ancienne pour l'affichage des sessions.
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
    // Matche par id de famille, ou par _id de token en repli, pour que les sessions créées
    // avant l'existence du champ sessionId (famille null) restent révocables par leur id.
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
