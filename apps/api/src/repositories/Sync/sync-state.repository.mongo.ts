/**
 * Repository (implémentation Mongo) de l'état du watcher de synchronisation.
 *
 * Persiste deux informations dans un unique document `watcher` : le resume token
 * des Change Streams (pour reprendre l'écoute là où elle s'est arrêtée) et le
 * drapeau one-shot indiquant que le flux initial (seed) a été produit.
 */
import type { Collection, Db, ResumeToken } from "mongodb";
import type { ISyncStateRepository } from "./sync-state.repository.js";

// Id du document unique qui stocke tout l'état du watcher.
const WATCHER_ID = "watcher";

interface SyncStateDoc {
  _id: string;
  resumeToken?: ResumeToken;
  seeded?: boolean;
  seededAt?: string;
}

export class MongoSyncStateRepository implements ISyncStateRepository {
  private collection: Collection<SyncStateDoc>;

  constructor(db: Db) {
    this.collection = db.collection<SyncStateDoc>("sync_state");
  }

  async getResumeToken(): Promise<ResumeToken | null> {
    const doc = await this.collection.findOne({ _id: WATCHER_ID });
    return doc?.resumeToken ?? null;
  }

  async saveResumeToken(token: ResumeToken): Promise<void> {
    await this.collection.updateOne({ _id: WATCHER_ID }, { $set: { resumeToken: token } }, { upsert: true });
  }

  // Efface le token (ex. l'oplog l'a dépassé) pour que la prochaine ouverture reparte de maintenant.
  async clearResumeToken(): Promise<void> {
    await this.collection.updateOne({ _id: WATCHER_ID }, { $unset: { resumeToken: "" } });
  }

  async isSeeded(): Promise<boolean> {
    const doc = await this.collection.findOne({ _id: WATCHER_ID });
    return doc?.seeded === true;
  }

  async markSeeded(): Promise<void> {
    await this.collection.updateOne(
      { _id: WATCHER_ID },
      { $set: { seeded: true, seededAt: new Date().toISOString() } },
      { upsert: true },
    );
  }
}
