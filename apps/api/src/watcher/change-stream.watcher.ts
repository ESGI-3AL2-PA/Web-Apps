/**
 * Watcher basé sur les Change Streams Mongo (§7).
 *
 * Un unique `db.watch()` couvre toutes les collections synchronisées : un seul flux
 * ordonné, donc les indices `sync_changes` qu'il distribue restent monotones. Il
 * enregistre *chaque* changement, qu'il vienne de l'api ou de la synchro ; une
 * instance en polling ignore ses propres écritures via `excludeInstance`, ce qui
 * empêche aussi un écho périmé d'écraser une édition locale tout juste poussée.
 *
 * Nécessite un replica set — `db.watch()` échoue sur un mongod standalone.
 */
import type { ChangeStream, ChangeStreamDocument, Db, Document, ResumeToken } from "mongodb";
import type { SyncOperation } from "@repo/contracts";
import { logger } from "../logger.js";
import type { ISyncChangesRepository } from "../repositories/Sync/sync-changes.repository.js";
import type { ISyncStateRepository } from "../repositories/Sync/sync-state.repository.js";
import { SYNCED_COLLECTIONS, entityForCollection, redactServerDoc } from "../sync/sync-entity-config.js";

/** Code d'erreur Mongo « l'oplog ne couvre plus le resume token ». */
const CHANGE_STREAM_HISTORY_LOST = 286;

/** Délai avant réouverture du flux après une erreur. */
const REOPEN_DELAY_MS = 5_000;

// Correspondance operationType Mongo → opération de synchro. `replace` (upsert qui
// remplace tout le doc) est assimilé à un INSERT côté synchro.
const OPERATIONS: Partial<Record<ChangeStreamDocument["operationType"], SyncOperation>> = {
  insert: "INSERT",
  replace: "INSERT",
  update: "UPDATE",
  delete: "DELETE",
};

// État module : le flux courant et un drapeau d'arrêt volontaire. `stopped` distingue
// une fermeture demandée (stopWatcher) d'une erreur, pour ne pas rouvrir dans ce cas.
let stream: ChangeStream<Document> | null = null;
let stopped = false;

/**
 * Traite un événement du change stream : le convertit en ligne `sync_changes` et
 * persiste le resume token. Ignore les événements sans opération/namespace/document et
 * les collections non synchronisées. La provenance (`_sync.origin` / `instanceId`) est
 * lue depuis le document complet pour marquer l'origine api vs synchro.
 */
const handle = async (
  event: ChangeStreamDocument<Document>,
  changes: ISyncChangesRepository,
  state: ISyncStateRepository,
): Promise<void> => {
  const operation = OPERATIONS[event.operationType];
  // Les événements techniques (invalidate, drop, rename, …) n'ont ni namespace ni document.
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

/**
 * Ouvre le change stream sur les collections synchronisées, en reprenant après le
 * dernier resume token connu si présent. `fullDocument: "updateLookup"` fait remonter
 * le document complet même sur un UPDATE. Rebranche les handlers change/error.
 */
const open = async (db: Db, changes: ISyncChangesRepository, state: ISyncStateRepository): Promise<void> => {
  if (stopped) return;

  const resumeAfter = (await state.getResumeToken()) ?? undefined;
  // Filtre serveur : ne surveiller que les collections synchronisées.
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
      // L'oplog a dépassé notre token : les changements de cette fenêtre sont perdus
      // définitivement. On rouvre à partir de maintenant pour que le flux reprenne, et
      // on journalise fort pour rendre le trou visible.
      logger.error({ err }, "sync watcher: CHANGE STREAM HISTORY LOST — feed has a gap; reopening without a token");
      void state.clearResumeToken();
    } else {
      logger.error({ err }, "sync watcher: change stream error — reopening");
    }
    void reopen(db, changes, state);
  });
};

/** Ferme le flux courant puis, après `REOPEN_DELAY_MS`, le rouvre — sauf arrêt volontaire. */
const reopen = async (db: Db, changes: ISyncChangesRepository, state: ISyncStateRepository): Promise<void> => {
  await stream?.close().catch(() => undefined);
  stream = null;
  if (stopped) return;
  await new Promise((r) => setTimeout(r, REOPEN_DELAY_MS));
  await open(db, changes, state).catch((err) => logger.error({ err }, "sync watcher: failed to reopen"));
};

/** Démarre le watcher : réarme le drapeau d'arrêt et ouvre le flux. */
export const startWatcher = async (
  db: Db,
  changes: ISyncChangesRepository,
  state: ISyncStateRepository,
): Promise<void> => {
  stopped = false;
  await open(db, changes, state);
};

/** Arrête proprement le watcher et ferme le flux ; empêche toute réouverture ultérieure. */
export const stopWatcher = async (): Promise<void> => {
  stopped = true;
  await stream?.close().catch(() => undefined);
  stream = null;
};
