/**
 * First-boot feed seeding (§5.2).
 *
 * Streams every existing document of each synced collection into `sync_changes` as a
 * synthetic api-origin INSERT, which makes `GET /changes?since=0` a complete
 * snapshot. That collapses bootstrap and incremental sync into a single client pull
 * path. Idempotent — guarded by the one-shot `sync_state.seeded` flag, and it shares
 * the same counter as the live watcher so indices stay monotonic across the boundary.
 */
import type { Db } from "mongodb";
import { logger } from "../logger.js";
import type { ISyncChangesRepository } from "../repositories/Sync/sync-changes.repository.js";
import type { ISyncStateRepository } from "../repositories/Sync/sync-state.repository.js";
import { SYNC_ENTITIES, redactServerDoc } from "../sync/sync-entity-config.js";
import type { SyncEntity } from "@repo/contracts";

export const seedExistingDocs = async (
  db: Db,
  changes: ISyncChangesRepository,
  state: ISyncStateRepository,
): Promise<number> => {
  if (await state.isSeeded()) return 0;

  const occurredAt = new Date().toISOString();
  let seeded = 0;

  for (const [entity, config] of Object.entries(SYNC_ENTITIES) as [SyncEntity, (typeof SYNC_ENTITIES)[SyncEntity]][]) {
    const cursor = db.collection(config.collection).find({});
    for await (const doc of cursor) {
      await changes.append({
        entity,
        operation: "INSERT",
        mongoId: String(doc._id),
        data: redactServerDoc(doc),
        occurredAt,
        origin: "api",
        originInstanceId: null,
      });
      seeded++;
    }
  }

  await state.markSeeded();
  logger.info({ seeded }, "sync: seeded the change feed from existing documents");
  return seeded;
};
