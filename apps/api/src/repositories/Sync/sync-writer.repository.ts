import type { SyncEntity } from "@repo/contracts";
import type { SyncProvenance } from "@repo/shared";

export type SyncDoc = Record<string, unknown>;

/**
 * `null` marks a server-origin write: the `_sync` stamp is cleared instead of set.
 * Conflict resolutions use it so the resolved state is NOT echo-skipped by the very
 * instance that raised the conflict — that instance needs the pull to clear its
 * pending row (§6.5).
 */
export type SyncStamp = SyncProvenance | null;

/**
 * The only path H2-originated data takes into the domain collections. Every method
 * narrows the payload through the entity's allowlist and stamps `_sync`, and the
 * write methods return the **exact persisted** `updatedAt` (not a re-read) so the
 * ingest ack can advance the client's optimistic-concurrency token synchronously.
 */
export interface ISyncWriterRepository {
  findById(entity: SyncEntity, id: string): Promise<SyncDoc | null>;

  /** Business-key lookup used to dedup a first INSERT (§6.1). */
  findByBusinessKey(entity: SyncEntity, value: unknown): Promise<SyncDoc | null>;

  /** Insert, or — with an explicit `id` — idempotently upsert an allowlisted document. */
  insert(
    entity: SyncEntity,
    data: SyncDoc,
    sync: SyncStamp,
    id?: string,
  ): Promise<{ mongoId: string; updatedAt: string }>;

  update(entity: SyncEntity, id: string, data: SyncDoc, sync: SyncStamp): Promise<{ updatedAt: string } | null>;

  remove(entity: SyncEntity, id: string): Promise<boolean>;

  /** Bump `updatedAt` so a `server`-resolved conflict re-propagates to every instance. */
  touch(entity: SyncEntity, id: string): Promise<{ updatedAt: string } | null>;
}

/** Mongo's duplicate-key error — a lost race on the `user.email` unique index. */
export const isDuplicateKeyError = (err: unknown): boolean =>
  typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
