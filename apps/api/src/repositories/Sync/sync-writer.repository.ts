/**
 * Contrat du repository du writer de synchronisation + types associés.
 *
 * Unique porte d'entrée par laquelle des données d'origine client (H2) atteignent
 * les collections métier.
 */
import type { SyncEntity } from "@repo/contracts";
import type { SyncProvenance } from "@repo/shared";

export type SyncDoc = Record<string, unknown>;

/**
 * `null` marque une écriture d'origine serveur : le stamp `_sync` est effacé au lieu
 * d'être posé. Les résolutions de conflit s'en servent pour que l'état résolu ne soit
 * PAS écho-ignoré par l'instance même qui avait déclenché le conflit — cette instance
 * a besoin du pull pour effacer sa ligne « pending » (§6.5).
 */
export type SyncStamp = SyncProvenance | null;

/**
 * Chaque méthode restreint le payload via l'allowlist de l'entité et estampille `_sync` ;
 * les méthodes d'écriture renvoient l'`updatedAt` **exactement persisté** (pas une
 * relecture) pour que l'ack d'ingestion fasse avancer le token de concurrence optimiste
 * du client de façon synchrone.
 */
export interface ISyncWriterRepository {
  findById(entity: SyncEntity, id: string): Promise<SyncDoc | null>;

  /** Recherche par clé métier, utilisée pour dédupliquer un premier INSERT (§6.1). */
  findByBusinessKey(entity: SyncEntity, value: unknown): Promise<SyncDoc | null>;

  /** Insert, ou — avec un `id` explicite — upsert idempotent d'un document allowlisté. */
  insert(
    entity: SyncEntity,
    data: SyncDoc,
    sync: SyncStamp,
    id?: string,
  ): Promise<{ mongoId: string; updatedAt: string }>;

  update(entity: SyncEntity, id: string, data: SyncDoc, sync: SyncStamp): Promise<{ updatedAt: string } | null>;

  remove(entity: SyncEntity, id: string): Promise<boolean>;

  /** Remonte `updatedAt` pour qu'un conflit résolu côté `serveur` se re-propage à chaque instance. */
  touch(entity: SyncEntity, id: string): Promise<{ updatedAt: string } | null>;
}

/** Erreur de clé dupliquée Mongo (code 11000) — une course perdue sur l'index unique `user.email`. */
export const isDuplicateKeyError = (err: unknown): boolean =>
  typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
