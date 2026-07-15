import pino from "pino";

/**
 * App-wide structured logger. Emits JSON to stdout so logs can be shipped to an
 * aggregator; level comes from LOG_LEVEL (default "info"). pino-http (wired in
 * index.ts) attaches a per-request child logger as `req.log` carrying a correlation
 * id, so request-path code should prefer `req.log` when it has a request in hand.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
});
