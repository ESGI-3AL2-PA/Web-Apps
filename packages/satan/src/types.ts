/**
 * Types describing the worker's output — a structured subset of MongoDB
 * operations. The Node client does NOT execute the query: it only translates
 * and returns this descriptor, leaving the repository / use-case layer to drive
 * the Mongo driver.
 */

export type MongoFilter = Record<string, unknown>;
export type MongoDocument = Record<string, unknown>;

export interface MongoFindOp {
  op: "find";
  collection: string;
  filter: MongoFilter;
  projection?: Record<string, 1>;
  sort?: Array<[string, 1 | -1]>;
  limit?: number;
  skip?: number;
}

export interface MongoInsertOp {
  op: "insertOne";
  collection: string;
  document: MongoDocument;
}

export interface MongoUpdateOp {
  op: "updateMany";
  collection: string;
  filter: MongoFilter;
  update: { $set: MongoDocument };
}

export interface MongoDeleteOp {
  op: "deleteMany";
  collection: string;
  filter: MongoFilter;
}

export type SatanOp = MongoFindOp | MongoInsertOp | MongoUpdateOp | MongoDeleteOp;

/**
 * Raw shape emitted by worker.py on stdout (ndjson).
 */
export interface SatanResponse<T = SatanOp> {
  id: string;
  ok: boolean;
  result?: T;
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
