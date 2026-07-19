import { randomUUID } from "crypto";
import type { Collection, Db, Filter } from "mongodb";
import { toEntity, type WithMongoId } from "@repo/shared";
import { districtOf } from "../../sync/sync-entity-config.js";
import type { ICounterRepository } from "./counter.repository.js";
import type { ISyncChangesRepository, NewSyncChange, SyncChange } from "./sync-changes.repository.js";

type SyncChangeDoc = WithMongoId<SyncChange>;

export const SYNC_CHANGES_COUNTER = "sync_changes";

export class MongoSyncChangesRepository implements ISyncChangesRepository {
  private collection: Collection<SyncChangeDoc>;

  constructor(
    db: Db,
    private counters: ICounterRepository,
  ) {
    this.collection = db.collection<SyncChangeDoc>("sync_changes");
  }

  async ensureIndexes(): Promise<void> {
    await Promise.all([
      this.collection.createIndex({ index: 1 }, { unique: true }),
      // Backs the district-scoped feed scan.
      this.collection.createIndex({ index: 1, districtId: 1 }),
      // Backs the DELETE district inheritance lookup.
      this.collection.createIndex({ mongoId: 1, index: -1 }),
    ]);
  }

  async append(change: NewSyncChange): Promise<SyncChange> {
    const districtId = await this.resolveDistrictId(change);
    const index = await this.counters.next(SYNC_CHANGES_COUNTER);
    const doc: SyncChangeDoc = { ...change, _id: randomUUID(), index, districtId };
    await this.collection.insertOne(doc);
    return toEntity<SyncChange>(doc);
  }

  private async resolveDistrictId(change: NewSyncChange): Promise<string | null> {
    const fromData = districtOf(change.entity, change.data);
    if (fromData) return fromData;
    // A district DELETE still scopes to its own id, which is the mongoId.
    if (change.entity === "district") return change.mongoId;
    if (change.operation !== "DELETE") return null;
    const previous = await this.collection.findOne({ mongoId: change.mongoId }, { sort: { index: -1 } });
    return previous?.districtId ?? null;
  }

  async list(params: {
    since: number;
    limit: number;
    excludeInstance?: string;
    scope: { all: true } | { districtId: string } | { empty: true };
  }): Promise<SyncChange[]> {
    const { since, limit, excludeInstance, scope } = params;

    const filter: Filter<SyncChangeDoc> = { index: { $gt: since } };
    if (excludeInstance) filter.originInstanceId = { $ne: excludeInstance };

    // Districts are reference data — every caller gets them regardless of scope, so
    // the client can render readable names offline. They carry no PII.
    if ("districtId" in scope) {
      filter.$or = [{ entity: "district" }, { districtId: scope.districtId }];
    } else if ("empty" in scope) {
      filter.entity = "district";
    }

    const docs = await this.collection.find(filter).sort({ index: 1 }).limit(limit).toArray();
    return docs.map((d) => toEntity<SyncChange>(d));
  }
}
