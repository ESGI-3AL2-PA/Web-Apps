/**
 * Repository (implémentation Mongo) du writer de synchronisation.
 *
 * Seul chemin par lequel des données d'origine client atteignent les collections
 * métier : chaque écriture est passée par l'allowlist de l'entité (`pickWritable`),
 * appliquée sur la collection cible résolue via `SYNC_ENTITIES`, et estampillée par
 * `_sync` pour que le watcher taggue la bonne origine sur l'entrée de flux produite.
 */
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

  // `_sync` est posé sur une écriture d'origine client et effacé sur une écriture d'origine
  // serveur, pour que le watcher taggue l'entrée de flux résultante avec la bonne origine.
  private stamp(sync: SyncStamp): Pick<UpdateFilter<Document>, "$set" | "$unset"> {
    return sync ? { $set: { _sync: sync } } : { $unset: { _sync: "" } };
  }

  async findById(entity: SyncEntity, id: string): Promise<SyncDoc | null> {
    return this.collection(entity).findOne({ _id: id as unknown as Document["_id"] });
  }

  /** Recherche par clé métier (ex. `email`), utilisée pour dédupliquer un premier INSERT (§6.1). */
  async findByBusinessKey(entity: SyncEntity, value: unknown): Promise<SyncDoc | null> {
    const key = SYNC_ENTITIES[entity].businessKey;
    if (!key || value === undefined || value === null) return null;
    return this.collection(entity).findOne({ [key]: value });
  }

  /** Insert, ou — avec un `id` explicite — upsert idempotent d'un document allowlisté. */
  async insert(
    entity: SyncEntity,
    data: SyncDoc,
    sync: SyncStamp,
    id?: string,
  ): Promise<{ mongoId: string; updatedAt: string }> {
    const now = new Date().toISOString();
    const mongoId = id ?? randomUUID();
    const writable = pickWritable(entity, data);

    // Un défaut également fourni par le payload provoquerait une collision ($set et
    // $setOnInsert ne peuvent pas toucher le même chemin) : la valeur du client l'emporte.
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

  // Remonte `updatedAt` et efface `_sync` (écriture d'origine serveur) : une résolution
  // de conflit côté `serveur` se re-propage ainsi vers toutes les instances.
  async touch(entity: SyncEntity, id: string): Promise<{ updatedAt: string } | null> {
    const now = new Date().toISOString();
    const result = await this.collection(entity).updateOne({ _id: id as unknown as Document["_id"] }, {
      $set: { updatedAt: now },
      $unset: { _sync: "" },
    } as UpdateFilter<Document>);
    return result.matchedCount === 1 ? { updatedAt: now } : null;
  }
}
