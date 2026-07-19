import type { ConflictResolution, ConflictStatus, ConflictType, SyncEntity } from "@repo/contracts";

export interface SyncConflict {
  id: string;
  entity: SyncEntity;
  mongoId: string;
  type: ConflictType;
  /** Install whose push raised this — powers the desktop `mine` filter (§6.5). */
  originInstanceId: string;
  localData: Record<string, unknown>;
  serverData: Record<string, unknown> | null;
  baseUpdatedAt?: string;
  status: ConflictStatus;
  detectedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolution?: ConflictResolution;
}

export type NewSyncConflict = Omit<SyncConflict, "id" | "status" | "detectedAt">;

export interface ISyncConflictsRepository {
  ensureIndexes(): Promise<void>;

  create(conflict: NewSyncConflict): Promise<SyncConflict>;

  /** The open conflict holding further ingests for a record, if any (§6.2). */
  findPending(entity: SyncEntity, mongoId: string): Promise<SyncConflict | null>;

  /** Re-capture the client's snapshot on a held record without raising a new conflict. */
  refreshLocalData(id: string, localData: Record<string, unknown>): Promise<void>;

  list(params: {
    status: ConflictStatus;
    entity?: SyncEntity;
    originInstanceId?: string;
    limit: number;
  }): Promise<SyncConflict[]>;

  getById(id: string): Promise<SyncConflict | null>;

  /** Guarded: only flips a `pending` conflict, so a double-resolve is a no-op. */
  markResolved(id: string, resolution: ConflictResolution, resolvedBy: string): Promise<SyncConflict | null>;
}
