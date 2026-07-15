import type { ClientSession } from "mongodb";
import { getMongoClient } from "./mongodb.connector.js";
import { logger } from "../logger.js";

// Cached capability probe: null = unknown, true = replica set (transactions work),
// false = standalone (transactions unsupported, fall back to sequential writes).
let txSupported: boolean | null = null;

const isNoTransactionSupportError = (err: unknown): boolean => {
  const msg = err instanceof Error ? err.message : String(err);
  return /only allowed on a replica set|Transactions are not supported|replica set member or mongos/i.test(msg);
};

/**
 * Run `fn` inside a Mongo multi-document transaction when the server supports it
 * (a replica set); on a standalone server it detects the missing support once and
 * falls back to running `fn` with no session (sequential writes). The same money
 * code therefore works in single-node dev and in a replica-set deployment — atomic
 * where possible, best-effort otherwise (callers keep their fallback logging).
 *
 * The capability error is raised by the server on the first write attempt, before
 * anything is committed, so falling back and re-running `fn(undefined)` is safe.
 */
export const runInTransaction = async <T>(fn: (session?: ClientSession) => Promise<T>): Promise<T> => {
  if (txSupported === false) return fn(undefined);

  const session = getMongoClient().startSession();
  try {
    let result: T;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    txSupported = true;
    return result!;
  } catch (err) {
    if (txSupported === null && isNoTransactionSupportError(err)) {
      txSupported = false;
      logger.warn("Mongo transactions unavailable (standalone server) — using sequential writes");
      return fn(undefined);
    }
    throw err;
  } finally {
    await session.endSession();
  }
};
