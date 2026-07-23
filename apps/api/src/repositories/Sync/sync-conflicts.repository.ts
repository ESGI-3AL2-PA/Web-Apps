/**
 * Contrat du repository des conflits de synchronisation + type d'entité `SyncConflict`.
 *
 * Un conflit matérialise une collision entre le snapshot poussé par un client
 * (`localData`) et l'état serveur (`serverData`) ; il reste `pending` jusqu'à sa
 * résolution par un opérateur (choix `client` ou `serveur`).
 */
import type { ConflictResolution, ConflictStatus, ConflictType, SyncEntity } from "@repo/contracts";

export interface SyncConflict {
  id: string;
  entity: SyncEntity;
  mongoId: string;
  type: ConflictType;
  /** Installation dont le push a déclenché le conflit — alimente le filtre `mine` du desktop (§6.5). */
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

/** Conflit à créer : `id`, `status` (« pending ») et `detectedAt` sont posés par le repository. */
export type NewSyncConflict = Omit<SyncConflict, "id" | "status" | "detectedAt">;

export interface ISyncConflictsRepository {
  ensureIndexes(): Promise<void>;

  create(conflict: NewSyncConflict): Promise<SyncConflict>;

  /** Le conflit ouvert qui met en attente les ingestions suivantes d'un enregistrement, s'il existe (§6.2). */
  findPending(entity: SyncEntity, mongoId: string): Promise<SyncConflict | null>;

  /** Recapture le snapshot du client sur un enregistrement en attente sans ouvrir de nouveau conflit. */
  refreshLocalData(id: string, localData: Record<string, unknown>): Promise<void>;

  list(params: {
    status: ConflictStatus;
    entity?: SyncEntity;
    originInstanceId?: string;
    limit: number;
  }): Promise<SyncConflict[]>;

  getById(id: string): Promise<SyncConflict | null>;

  /** Gardé : ne bascule qu'un conflit `pending`, donc une double résolution est un no-op. */
  markResolved(id: string, resolution: ConflictResolution, resolvedBy: string): Promise<SyncConflict | null>;
}
