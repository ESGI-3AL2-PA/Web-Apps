/**
 * Amorçage du flux au premier démarrage (§5.2).
 *
 * Parcourt chaque document existant de toutes les collections synchronisées et l'insère
 * dans `sync_changes` comme un INSERT synthétique d'origine api ; ainsi
 * `GET /changes?since=0` devient un snapshot complet. Bootstrap et synchro incrémentale
 * partagent donc un unique chemin de pull côté client. Idempotent : protégé par le
 * drapeau one-shot `sync_state.seeded`, et il partage le même compteur que le watcher
 * live pour que les indices restent monotones de part et d'autre de la frontière.
 */
import type { Db } from "mongodb";
import { logger } from "../logger.js";
import type { ISyncChangesRepository } from "../repositories/Sync/sync-changes.repository.js";
import type { ISyncStateRepository } from "../repositories/Sync/sync-state.repository.js";
import { SYNC_ENTITIES, redactServerDoc } from "../sync/sync-entity-config.js";
import type { SyncEntity } from "@repo/contracts";

/**
 * Amorce `sync_changes` à partir des documents déjà présents. No-op si déjà amorcé.
 * Retourne le nombre de documents injectés. Un unique `occurredAt` est partagé par
 * toutes les lignes de ce seed.
 */
export const seedExistingDocs = async (
  db: Db,
  changes: ISyncChangesRepository,
  state: ISyncStateRepository,
): Promise<number> => {
  // Garde d'idempotence : ne rejoue jamais le seed sur un flux déjà amorcé.
  if (await state.isSeeded()) return 0;

  const occurredAt = new Date().toISOString();
  let seeded = 0;

  // Pour chaque entité synchronisée, on stream sa collection au curseur et on émet un
  // INSERT synthétique par document. `redactServerDoc` retire les champs non exposables.
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

  // Pose le drapeau one-shot pour qu'un futur démarrage n'amorce pas de nouveau.
  await state.markSeeded();
  logger.info({ seeded }, "sync: seeded the change feed from existing documents");
  return seeded;
};
