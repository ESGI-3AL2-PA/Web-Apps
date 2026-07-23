/**
 * Contrat du repository du flux de changements de synchronisation + type d'entité `SyncChange`.
 *
 * Le flux est un journal append-only : chaque entrée décrit une opération
 * (INSERT/UPDATE/DELETE) sur une entité synchronisable, indexée par un curseur
 * monotone que les clients hors-ligne suivent pour rejouer les changements.
 */
import type { SyncEntity, SyncOperation } from "@repo/contracts";
import type { SyncScope } from "../../sync/sync-scope.js";

/** Origine d'une entrée : produite par l'API (écriture serveur) ou par une ingestion sync. */
export type ChangeOrigin = "api" | "sync";

/** Une entrée du flux de changements. */
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
   * Dénormalisé pour filtrer le flux par quartier sans lire `data` — une entrée
   * DELETE n'en a pas. Voir §5.5.
   */
  districtId: string | null;
}

/** Entrée à insérer : l'`id`, l'`index` et le `districtId` sont attribués par le repository. */
export type NewSyncChange = Omit<SyncChange, "id" | "index" | "districtId">;

export interface ISyncChangesRepository {
  ensureIndexes(): Promise<void>;

  /**
   * Ajoute une entrée en attribuant l'index de flux suivant et en résolvant son `districtId`.
   * Sur un DELETE le document complet a disparu : le quartier est donc hérité de l'entrée
   * antérieure la plus récente pour le même `mongoId` ; s'il n'y en a pas, l'entrée est
   * stockée avec `districtId: null` et n'est visible que du `superAdmin` (fail-closed).
   */
  append(change: NewSyncChange): Promise<SyncChange>;

  /** Page du flux, `index` croissant, filtrée par le scope de quartier du demandeur. */
  list(params: { since: number; limit: number; excludeInstance?: string; scope: SyncScope }): Promise<SyncChange[]>;
}
