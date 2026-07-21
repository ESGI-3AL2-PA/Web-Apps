import { logger } from "./logger.js";

export interface RetryOptions {
  /** Max attempts before giving up (default 10). */
  retries?: number;
  /** Delay before the first retry, in ms (default 1000). Doubles each attempt. */
  minDelayMs?: number;
  /** Cap on the backoff delay, in ms (default 5000). */
  maxDelayMs?: number;
  /** Human-readable label for the log line on each failed attempt. */
  label?: string;
}

/**
 * Runs `fn`, retrying with exponential backoff on rejection. Used at boot to ride
 * out a datastore that isn't accepting connections yet: `depends_on:
 * service_healthy` only orders the *first* startup, and tsx --watch doesn't
 * re-run the entrypoint after a fatal exit — so a transient DB blip on (re)boot
 * would otherwise wedge the dev process until a file changes. Rethrows the last
 * error once the attempts are exhausted.
 */
export const withRetry = async <T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> => {
  const { retries = 10, minDelayMs = 1000, maxDelayMs = 5000, label = "operation" } = opts;
  let lastError: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === retries) break;
      const delay = Math.min(maxDelayMs, minDelayMs * 2 ** (attempt - 1));
      logger.warn({ err, attempt, retries, delayMs: delay }, `${label} failed — retrying in ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
};
