/**
 * Repository (implémentation en mémoire) des conflits de synchronisation.
 *
 * Réplique fidèlement le comportement de la version Mongo (gardes de résolution
 * incluses) sur un simple tableau, pour que les tests exercent la vraie logique
 * sans dépendre d'une base.
 */
import { randomUUID } from "crypto";
import type { ConflictResolution, ConflictStatus, SyncEntity } from "@repo/contracts";
import type { ISyncConflictsRepository, NewSyncConflict, SyncConflict } from "./sync-conflicts.repository.js";

export class InMemorySyncConflictsRepository implements ISyncConflictsRepository {
  rows: SyncConflict[] = [];
  /** Injectable pour que les tests puissent asserter sur des ids de conflit stables. */
  nextId: () => string = () => randomUUID();

  async ensureIndexes(): Promise<void> {
    // No-op : le repository en mémoire n'a pas d'index.
  }

  async create(conflict: NewSyncConflict): Promise<SyncConflict> {
    const row: SyncConflict = {
      ...conflict,
      id: this.nextId(),
      status: "pending",
      detectedAt: new Date().toISOString(),
    };
    this.rows.push(row);
    return row;
  }

  async findPending(entity: SyncEntity, mongoId: string): Promise<SyncConflict | null> {
    return this.rows.find((r) => r.entity === entity && r.mongoId === mongoId && r.status === "pending") ?? null;
  }

  async refreshLocalData(id: string, localData: Record<string, unknown>): Promise<void> {
    const row = this.rows.find((r) => r.id === id && r.status === "pending");
    if (row) row.localData = localData;
  }

  async list(params: {
    status: ConflictStatus;
    entity?: SyncEntity;
    originInstanceId?: string;
    limit: number;
  }): Promise<SyncConflict[]> {
    return this.rows
      .filter(
        (r) =>
          r.status === params.status &&
          (!params.entity || r.entity === params.entity) &&
          (!params.originInstanceId || r.originInstanceId === params.originInstanceId),
      )
      .slice(0, params.limit);
  }

  async getById(id: string): Promise<SyncConflict | null> {
    return this.rows.find((r) => r.id === id) ?? null;
  }

  // Gardé comme la version Mongo : une seconde résolution ne trouve plus rien de « pending » et s'abstient.
  async markResolved(id: string, resolution: ConflictResolution, resolvedBy: string): Promise<SyncConflict | null> {
    const row = this.rows.find((r) => r.id === id && r.status === "pending");
    if (!row) return null;
    Object.assign(row, { status: "resolved", resolution, resolvedBy, resolvedAt: new Date().toISOString() });
    return row;
  }
}
