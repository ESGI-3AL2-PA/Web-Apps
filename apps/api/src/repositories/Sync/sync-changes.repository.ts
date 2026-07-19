import type { SyncEntity, SyncOperation } from "@repo/contracts";
import type { SyncScope } from "../../sync/sync-scope.js";

export type ChangeOrigin = "api" | "sync";

export interface SyncChange {
  id: string;
  index: number;
  entity: SyncEntity;
  operation: SyncOperation;
  mongoId: string;
  data: Record<string, unknown> | null;
  occurredAt: string;
  origin: ChangeOrigin;
  originInstanceId: string | null;
  /**
   * Denormalized so the feed can be district-filtered without reading `data` —
   * a DELETE entry has none. See §5.5.
   */
  districtId: string | null;
}

export type NewSyncChange = Omit<SyncChange, "id" | "index" | "districtId">;

export interface ISyncChangesRepository {
  ensureIndexes(): Promise<void>;

  /**
   * Append one entry, assigning the next feed index and resolving its `districtId`.
   * On DELETE the full document is gone, so the district is inherited from the most
   * recent prior entry for the same `mongoId`; if there is none the entry is stored
   * with `districtId: null` and becomes visible to `superAdmin` only (fail-closed).
   */
  append(change: NewSyncChange): Promise<SyncChange>;

  /** Feed page, `index`-ascending, filtered by the caller's district scope. */
  list(params: { since: number; limit: number; excludeInstance?: string; scope: SyncScope }): Promise<SyncChange[]>;
}
