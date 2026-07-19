import type { Collection, Db, ResumeToken } from "mongodb";
import type { ISyncStateRepository } from "./sync-state.repository.js";

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
