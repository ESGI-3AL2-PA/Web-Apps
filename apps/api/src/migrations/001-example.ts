/**
 * 001-example — no-op example migration.
 *
 * Copy this file to `NNN-your-change.ts` (next number, zero-padded) and fill in
 * `up`. Keep `up` idempotent where you can (e.g. `createIndex` is safe to re-run)
 * so a half-applied run can be retried. Provide `down` when the change is
 * reversible; the runner uses it for `npm run migrate:down`.
 */

import type { Db } from "mongodb";

export const up = async (db: Db): Promise<void> => {
  // Example (left commented — this migration intentionally does nothing):
  //   await db.collection("users").createIndex({ email: 1 }, { unique: true });
  void db;
};

export const down = async (db: Db): Promise<void> => {
  // Reverse of `up`. Example:
  //   await db.collection("users").dropIndex("email_1");
  void db;
};
