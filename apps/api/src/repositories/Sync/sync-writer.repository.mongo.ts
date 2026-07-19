import { randomUUID } from "crypto";
import type { Db, Document, UpdateFilter } from "mongodb";
import type { SyncEntity } from "@repo/contracts";
import { SYNC_ENTITIES, pickWritable } from "../../sync/sync-entity-config.js";
import type { ISyncWriterRepository, SyncDoc, SyncStamp } from "./sync-writer.repository.js";

export class MongoSyncWriterRepository implements ISyncWriterRepository {
  constructor(private db: Db) {}

  private collection(entity: SyncEntity) {
    return this.db.collection<Document>(SYNC_ENTITIES[entity].collection);
  }

  // `_sync` is set on a client-origin write and cleared on a server-origin one, so
  // the watcher tags the resulting feed entry with the right origin either way.
  private stamp(sync: SyncStamp): Pick<UpdateFilter<Document>, "$set" | "$unset"> {
    return sync ? { $set: { _sync: sync } } : { $unset: { _sync: "" } };
  }

  async findById(entity: SyncEntity, id: string): Promise<SyncDoc | null> {
    return this.collection(entity).findOne({ _id: id as unknown as Document["_id"] });
  }

  async findByBusinessKey(entity: SyncEntity, value: unknown): Promise<SyncDoc | null> {
    const key = SYNC_ENTITIES[entity].businessKey;
    if (!key || value === undefined || value === null) return null;
    return this.collection(entity).findOne({ [key]: value });
  }

  async insert(
    entity: SyncEntity,
    data: SyncDoc,
    sync: SyncStamp,
    id?: string,
  ): Promise<{ mongoId: string; updatedAt: string }> {
    const now = new Date().toISOString();
    const mongoId = id ?? randomUUID();
    const writable = pickWritable(entity, data);

    // A default that the payload also supplies would collide ($set and $setOnInsert
    // may not touch the same path), so the client's value wins for those.
    const defaults = Object.fromEntries(
      Object.entries(SYNC_ENTITIES[entity].defaultsOnInsert).filter(([k]) => !(k in writable)),
    );

    const { $set, $unset } = this.stamp(sync);
    await this.collection(entity).updateOne(
      { _id: mongoId as unknown as Document["_id"] },
      {
        $set: { ...writable, updatedAt: now, ...$set },
        $setOnInsert: { ...defaults, createdAt: now },
        ...($unset ? { $unset } : {}),
      } as UpdateFilter<Document>,
      { upsert: true },
    );

    return { mongoId, updatedAt: now };
  }

  async update(entity: SyncEntity, id: string, data: SyncDoc, sync: SyncStamp): Promise<{ updatedAt: string } | null> {
    const now = new Date().toISOString();
    const { $set, $unset } = this.stamp(sync);
    const result = await this.collection(entity).updateOne({ _id: id as unknown as Document["_id"] }, {
      $set: { ...pickWritable(entity, data), updatedAt: now, ...$set },
      ...($unset ? { $unset } : {}),
    } as UpdateFilter<Document>);
    return result.matchedCount === 1 ? { updatedAt: now } : null;
  }

  async remove(entity: SyncEntity, id: string): Promise<boolean> {
    const result = await this.collection(entity).deleteOne({ _id: id as unknown as Document["_id"] });
    return result.deletedCount === 1;
  }

  async touch(entity: SyncEntity, id: string): Promise<{ updatedAt: string } | null> {
    const now = new Date().toISOString();
    const result = await this.collection(entity).updateOne({ _id: id as unknown as Document["_id"] }, {
      $set: { updatedAt: now },
      $unset: { _sync: "" },
    } as UpdateFilter<Document>);
    return result.matchedCount === 1 ? { updatedAt: now } : null;
  }
}
