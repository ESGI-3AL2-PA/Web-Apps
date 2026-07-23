/**
 * Repository (implémentation Mongo) des conflits de synchronisation.
 *
 * Un conflit est ouvert quand l'ingestion d'un push client entre en collision avec
 * l'état serveur ; il met en attente les ingestions suivantes du même enregistrement
 * jusqu'à sa résolution (client / serveur). Ce repository gère leur cycle de vie
 * (création, recherche du conflit ouvert, listage, résolution gardée).
 */
import { randomUUID } from "crypto";
import type { Collection, Db, Filter } from "mongodb";
import { toEntity, type WithMongoId } from "@repo/shared";
import type { ConflictResolution, ConflictStatus, SyncEntity } from "@repo/contracts";
import type { ISyncConflictsRepository, NewSyncConflict, SyncConflict } from "./sync-conflicts.repository.js";

type SyncConflictDoc = WithMongoId<SyncConflict>;

export class MongoSyncConflictsRepository implements ISyncConflictsRepository {
  private collection: Collection<SyncConflictDoc>;

  constructor(db: Db) {
    this.collection = db.collection<SyncConflictDoc>("sync_conflicts");
  }

  async ensureIndexes(): Promise<void> {
    await Promise.all([
      // Au plus un conflit ouvert par enregistrement — la mise en attente du §6.2 s'appuie sur cette recherche.
      this.collection.createIndex({ entity: 1, mongoId: 1, status: 1 }),
      // Soutient le listage `mine=true` du client desktop.
      this.collection.createIndex({ status: 1, originInstanceId: 1, detectedAt: -1 }),
    ]);
  }

  async create(conflict: NewSyncConflict): Promise<SyncConflict> {
    const doc: SyncConflictDoc = {
      ...conflict,
      _id: randomUUID(),
      status: "pending",
      detectedAt: new Date().toISOString(),
    };
    await this.collection.insertOne(doc);
    return toEntity<SyncConflict>(doc);
  }

  /** Le conflit ouvert (`pending`) qui met en attente un enregistrement, s'il existe. */
  async findPending(entity: SyncEntity, mongoId: string): Promise<SyncConflict | null> {
    const doc = await this.collection.findOne({ entity, mongoId, status: "pending" });
    return doc ? toEntity<SyncConflict>(doc) : null;
  }

  /** Recapture le snapshot du client sur un enregistrement en attente sans ouvrir de nouveau conflit. */
  async refreshLocalData(id: string, localData: Record<string, unknown>): Promise<void> {
    await this.collection.updateOne({ _id: id, status: "pending" }, { $set: { localData } });
  }

  async list(params: {
    status: ConflictStatus;
    entity?: SyncEntity;
    originInstanceId?: string;
    limit: number;
  }): Promise<SyncConflict[]> {
    const filter: Filter<SyncConflictDoc> = { status: params.status };
    if (params.entity) filter.entity = params.entity;
    if (params.originInstanceId) filter.originInstanceId = params.originInstanceId;

    const docs = await this.collection.find(filter).sort({ detectedAt: -1 }).limit(params.limit).toArray();
    return docs.map((d) => toEntity<SyncConflict>(d));
  }

  async getById(id: string): Promise<SyncConflict | null> {
    const doc = await this.collection.findOne({ _id: id });
    return doc ? toEntity<SyncConflict>(doc) : null;
  }

  // Gardé sur `status: "pending"` : une double résolution ne matche rien et est un no-op.
  async markResolved(id: string, resolution: ConflictResolution, resolvedBy: string): Promise<SyncConflict | null> {
    const doc = await this.collection.findOneAndUpdate(
      { _id: id, status: "pending" },
      { $set: { status: "resolved", resolution, resolvedBy, resolvedAt: new Date().toISOString() } },
      { returnDocument: "after" },
    );
    return doc ? toEntity<SyncConflict>(doc) : null;
  }
}
