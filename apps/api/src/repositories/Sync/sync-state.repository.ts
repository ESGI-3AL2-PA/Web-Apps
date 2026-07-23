/**
 * Contrat du repository de l'état du watcher de synchronisation.
 *
 * Suivi du watcher : le resume token des Change Streams + le drapeau one-shot de seed.
 */
import type { ResumeToken } from "mongodb";

export interface ISyncStateRepository {
  getResumeToken(): Promise<ResumeToken | null>;
  saveResumeToken(token: ResumeToken): Promise<void>;
  /** Efface le token après que l'oplog l'a dépassé, pour que la prochaine ouverture reparte de maintenant. */
  clearResumeToken(): Promise<void>;
  isSeeded(): Promise<boolean>;
  markSeeded(): Promise<void>;
}
