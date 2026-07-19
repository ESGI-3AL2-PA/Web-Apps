import type { ResumeToken } from "mongodb";

/** Watcher bookkeeping: the Change-Streams resume token + the one-shot seed flag. */
export interface ISyncStateRepository {
  getResumeToken(): Promise<ResumeToken | null>;
  saveResumeToken(token: ResumeToken): Promise<void>;
  /** Drop the token after the oplog rolled past it, so the next open starts from now. */
  clearResumeToken(): Promise<void>;
  isSeeded(): Promise<boolean>;
  markSeeded(): Promise<void>;
}
