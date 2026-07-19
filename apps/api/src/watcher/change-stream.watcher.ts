/**
 * Change-Streams watcher (§7).
 *
 * A single `db.watch()` over every synced collection — one ordered stream, so the
 * `sync_changes` indices it hands out stay monotonic. It records *every* change,
 * api-origin and sync-origin alike; a polling instance skips its own writes with
 * `excludeInstance`, which also stops a stale echo from clobbering a just-pushed
 * local edit.
 *
 * Requires a replica set — `db.watch()` throws on a standalone mongod.
 */
import type { ChangeStream, ChangeStreamDocument, Db, Document, ResumeToken } from "mongodb";
import type { SyncOperation } from "@repo/contracts";
import { logger } from "../logger.js";
import type { ISyncChangesRepository } from "../repositories/Sync/sync-changes.repository.js";
import type { ISyncStateRepository } from "../repositories/Sync/sync-state.repository.js";
import { SYNCED_COLLECTIONS, entityForCollection, redactServerDoc } from "../sync/sync-entity-config.js";

/** Mongo's "the oplog no longer covers the resume token" error. */
const CHANGE_STREAM_HISTORY_LOST = 286;

const REOPEN_DELAY_MS = 5_000;

const OPERATIONS: Partial<Record<ChangeStreamDocument["operationType"], SyncOperation>> = {
  insert: "INSERT",
  replace: "INSERT",
  update: "UPDATE",
  delete: "DELETE",
};

let stream: ChangeStream<Document> | null = null;
let stopped = false;

const handle = async (
  event: ChangeStreamDocument<Document>,
  changes: ISyncChangesRepository,
  state: ISyncStateRepository,
): Promise<void> => {
  const operation = OPERATIONS[event.operationType];
  // Bookkeeping events (invalidate, drop, rename, …) carry no namespace/document.
  if (!operation || !("ns" in event) || !("documentKey" in event)) return;

  const entity = entityForCollection(event.ns.coll);
  if (!entity) return;

  const fullDocument = "fullDocument" in event ? (event.fullDocument as Document | undefined) : undefined;
  const provenance = fullDocument?._sync as { origin?: string; instanceId?: string } | undefined;

  await changes.append({
    entity,
    operation,
    mongoId: String(event.documentKey._id),
    data: operation === "DELETE" ? null : redactServerDoc(fullDocument),
    occurredAt: new Date().toISOString(),
    origin: provenance?.origin === "sync" ? "sync" : "api",
    originInstanceId: provenance?.instanceId ?? null,
  });

  await state.saveResumeToken(event._id as ResumeToken);
};

const open = async (db: Db, changes: ISyncChangesRepository, state: ISyncStateRepository): Promise<void> => {
  if (stopped) return;

  const resumeAfter = (await state.getResumeToken()) ?? undefined;
  stream = db.watch<Document>([{ $match: { "ns.coll": { $in: SYNCED_COLLECTIONS } } }], {
    fullDocument: "updateLookup",
    resumeAfter,
  });
  logger.info({ collections: SYNCED_COLLECTIONS, resumed: !!resumeAfter }, "sync watcher: change stream open");

  stream.on("change", (event) => {
    void handle(event, changes, state).catch((err) => logger.error({ err }, "sync watcher: failed to record a change"));
  });

  stream.on("error", (err: Error & { code?: number }) => {
    if (stopped) return;
    if (err.code === CHANGE_STREAM_HISTORY_LOST) {
      // The oplog rolled past our token: changes in that window are lost for good.
      // Reopen from now so the feed keeps flowing, and make the gap loud.
      logger.error({ err }, "sync watcher: CHANGE STREAM HISTORY LOST — feed has a gap; reopening without a token");
      void state.clearResumeToken();
    } else {
      logger.error({ err }, "sync watcher: change stream error — reopening");
    }
    void reopen(db, changes, state);
  });
};

const reopen = async (db: Db, changes: ISyncChangesRepository, state: ISyncStateRepository): Promise<void> => {
  await stream?.close().catch(() => undefined);
  stream = null;
  if (stopped) return;
  await new Promise((r) => setTimeout(r, REOPEN_DELAY_MS));
  await open(db, changes, state).catch((err) => logger.error({ err }, "sync watcher: failed to reopen"));
};

export const startWatcher = async (
  db: Db,
  changes: ISyncChangesRepository,
  state: ISyncStateRepository,
): Promise<void> => {
  stopped = false;
  await open(db, changes, state);
};

export const stopWatcher = async (): Promise<void> => {
  stopped = true;
  await stream?.close().catch(() => undefined);
  stream = null;
};
