/**
 * Wire types for the worker protocol. The worker executes the query against
 * Mongo and returns the result, so the Node side is Mongo-agnostic — the op
 * descriptor / driver shapes live entirely in Python.
 */

/** Raw shape emitted by worker.py on stdout (ndjson). `result` is whatever the
 *  executed query returned (documents / driver counts). */
export interface SatanResponse {
  id: string;
  ok: boolean;
  result?: unknown;
  error?: string;
  trace?: string;
}

/**
 * Thrown by SatanClient.query() when the worker responds ok=false. Keeps the
 * original Python stack under .pythonTrace for debugging.
 */
export class SatanQueryError extends Error {
  public readonly pythonTrace?: string;

  constructor(message: string, pythonTrace?: string) {
    super(message);
    this.name = "SatanQueryError";
    this.pythonTrace = pythonTrace;
  }
}
