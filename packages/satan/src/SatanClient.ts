/**
 * SatanClient — Node ↔ worker.py bridge + Mongo execution.
 *
 * Lifecycle:
 *   - The first `query()`/`compile()` spawns ONE persistent Python process.
 *   - `compile(ql)` sends a JSON line to the worker and returns the translated
 *     `SatanOp` (correlated by UUID).
 *   - `query(ql)` compiles then RUNS the op against the Mongo `Db` passed to the
 *     client, returning the result (find → docs with `_id` mapped to `id`,
 *     writes → the driver's counts / inserted id).
 *   - If the process dies, every pending request is rejected and the worker is
 *     restarted automatically (unless `autoRestart: false` or `close()` ran).
 *
 * Best-effort, low-expectation query language: `query` returns `any`.
 */

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import path from "node:path";
import type { Db, Document, Filter, OptionalUnlessRequiredId, Sort } from "mongodb";

import { type SatanOp, SatanQueryError, type SatanResponse } from "./types";

interface PendingRequest {
  resolve: (value: SatanOp) => void;
  reject: (reason: Error) => void;
}

export interface SatanClientOptions {
  /** Mongo Db that `query()` runs the translated op against. Omit for a
   *  translate-only client (`compile()` still works, `query()` will throw). */
  db?: Db;
  /** Python binary to use (default: "python3"). */
  pythonBin?: string;
  /** Absolute path to worker.py (default: ../python/worker.py relative to dist/). */
  workerPath?: string;
  /** cwd of the child process. */
  cwd?: string;
  /** env of the child process. */
  env?: NodeJS.ProcessEnv;
  /** Restart the worker automatically if it crashes (default: true). */
  autoRestart?: boolean;
  /** Informational callback fired on each crash, BEFORE the restart. */
  onCrash?: (code: number | null, signal: NodeJS.Signals | null) => void;
}

const mapId = (doc: Document): Document => {
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
};

/**
 * Emits:
 *   - "stderr" (string)       : raw stderr line from the worker
 *   - "error"  (Error)        : broken protocol (invalid JSON, etc.)
 *   - "exit"   (code, signal) : worker terminated
 */
export class SatanClient extends EventEmitter {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private pending = new Map<string, PendingRequest>();
  private buffer = "";
  private closed = false;

  private readonly db?: Db;
  private readonly pythonBin: string;
  private readonly workerPath: string;
  private readonly cwd?: string;
  private readonly env?: NodeJS.ProcessEnv;
  private autoRestart: boolean;
  private readonly onCrash?: SatanClientOptions["onCrash"];

  constructor(opts: SatanClientOptions = {}) {
    super();
    this.db = opts.db;
    this.pythonBin = opts.pythonBin ?? "python3";
    // Default assumes the shipped layout:
    //   packages/satan/dist/SatanClient.js   (this file, after build)
    //   packages/satan/python/worker.py
    this.workerPath = opts.workerPath ?? path.resolve(__dirname, "..", "python", "worker.py");
    this.cwd = opts.cwd;
    this.env = opts.env;
    this.autoRestart = opts.autoRestart ?? true;
    this.onCrash = opts.onCrash;
  }

  /** Starts the worker if it isn't already running. Idempotent. */
  start(): void {
    if (this.proc || this.closed) return;

    const proc = spawn(this.pythonBin, [this.workerPath], {
      cwd: this.cwd,
      env: this.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.proc = proc;

    proc.stdout.setEncoding("utf-8");
    proc.stdout.on("data", (chunk: string) => this.onStdout(chunk));

    proc.stderr.setEncoding("utf-8");
    proc.stderr.on("data", (chunk: string) => this.emit("stderr", chunk));

    proc.on("exit", (code, signal) => {
      // Every pending request is doomed.
      const err = new SatanQueryError(`SATAN worker exited (code=${code}, signal=${signal})`);
      for (const [, p] of this.pending) p.reject(err);
      this.pending.clear();
      this.proc = null;
      this.buffer = "";

      this.emit("exit", code, signal);
      this.onCrash?.(code, signal);

      if (this.autoRestart && !this.closed) {
        this.start();
      }
    });
  }

  /**
   * Runs a SATAN QL query against the configured Mongo `Db` and returns the
   * result: `find` → the matching documents (with `_id` renamed to `id`),
   * `INSERT` → `{ insertedId }`, `UPDATE` → `{ matchedCount, modifiedCount }`,
   * `DELETE` → `{ deletedCount }`.
   * @throws SatanQueryError if parsing/translation fails or no `db` was set.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async query(ql: string): Promise<any> {
    const op = await this.compile(ql);
    return this.execute(op);
  }

  /**
   * Translates a SATAN QL query to its `SatanOp` descriptor WITHOUT touching
   * Mongo. Useful for tests, dry-runs, or driving another store.
   * @throws SatanQueryError if the parser/translator rejects the query.
   */
  compile(ql: string): Promise<SatanOp> {
    if (this.closed) {
      return Promise.reject(new SatanQueryError("SatanClient already closed"));
    }
    if (!this.proc) this.start();

    const id = randomUUID();
    const payload = JSON.stringify({ id, query: ql }) + "\n";

    return new Promise<SatanOp>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.proc!.stdin.write(payload, (err) => {
        if (err) {
          this.pending.delete(id);
          reject(err);
        }
      });
    });
  }

  /** Cleanly shuts the worker down. Any later query rejects. */
  async close(): Promise<void> {
    this.closed = true;
    this.autoRestart = false;
    if (!this.proc) return;
    this.proc.stdin.end();
    await new Promise<void>((resolve) => {
      this.proc!.once("exit", () => resolve());
    });
    this.proc = null;
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------
  private async execute(op: SatanOp): Promise<unknown> {
    if (!this.db) {
      throw new SatanQueryError("SatanClient.query() needs a Mongo Db — pass { db } to createSatanClient()");
    }
    const collection = this.db.collection(op.collection);
    switch (op.op) {
      case "find": {
        const docs = await collection
          .find(op.filter as Filter<Document>, {
            projection: op.projection,
            sort: op.sort ? (Object.fromEntries(op.sort) as Sort) : undefined,
            limit: op.limit,
            skip: op.skip,
          })
          .toArray();
        return docs.map(mapId);
      }
      case "insertOne": {
        const result = await collection.insertOne(op.document as OptionalUnlessRequiredId<Document>);
        return { insertedId: result.insertedId };
      }
      case "updateMany": {
        const result = await collection.updateMany(op.filter as Filter<Document>, op.update);
        return { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount };
      }
      case "deleteMany": {
        const result = await collection.deleteMany(op.filter as Filter<Document>);
        return { deletedCount: result.deletedCount };
      }
    }
  }

  private onStdout(chunk: string): void {
    this.buffer += chunk;
    let nl: number;
    while ((nl = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, nl).trim();
      this.buffer = this.buffer.slice(nl + 1);
      if (!line) continue;

      let resp: SatanResponse;
      try {
        resp = JSON.parse(line) as SatanResponse;
      } catch {
        this.emit("error", new Error(`Invalid JSON received from worker: ${line.slice(0, 200)}`));
        continue;
      }

      const pending = this.pending.get(resp.id);
      if (!pending) continue; // orphan response, ignored
      this.pending.delete(resp.id);

      if (resp.ok && resp.result) {
        pending.resolve(resp.result as SatanOp);
      } else {
        pending.reject(new SatanQueryError(resp.error ?? "Unknown SATAN error", resp.trace));
      }
    }
  }
}

/** Syntactic sugar for `new SatanClient(opts)`. */
export function createSatanClient(opts?: SatanClientOptions): SatanClient {
  return new SatanClient(opts);
}
