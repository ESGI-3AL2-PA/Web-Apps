/**
 * SatanClient — thin Node ↔ worker.py bridge.
 *
 * The Python worker parses, translates AND runs the query against MongoDB and
 * returns the result; this client only spawns/keeps that process alive and
 * relays queries. It does NOT touch Mongo — it never imports the driver. Point
 * the worker at a database with `mongoUrl` / `mongoDb` (forwarded as env vars).
 *
 * Lifecycle:
 *   - The first `query()` spawns ONE persistent Python process.
 *   - `query(ql)` writes a JSON line to stdin and resolves the worker's result.
 *   - If the process dies, pending requests reject and the worker restarts
 *     automatically (unless `autoRestart: false` or `close()` ran).
 */

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import path from "node:path";

import { SatanQueryError, type SatanResponse } from "./types";

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer?: ReturnType<typeof setTimeout>;
}

export interface SatanClientOptions {
  /** Mongo connection string the worker runs queries against (forwarded to the
   *  subprocess as MONGODB_URL). Omit to let the worker use its own env/default. */
  mongoUrl?: string;
  /** Mongo database name (forwarded as MONGODB_DB). */
  mongoDb?: string;
  /** Python binary to use (default: "python3"). */
  pythonBin?: string;
  /** Absolute path to worker.py (default: ../python/worker.py relative to dist/). */
  workerPath?: string;
  /** cwd of the child process. */
  cwd?: string;
  /** env of the child process (defaults to inheriting process.env). */
  env?: NodeJS.ProcessEnv;
  /** Restart the worker automatically if it crashes (default: true). */
  autoRestart?: boolean;
  /**
   * Per-query backstop timeout in ms (default: 8000; 0 disables). The worker
   * runs one query at a time, so a single stuck query would block the whole
   * queue — on timeout the pending query rejects and the worker is force-recycled
   * (a fresh one starts when autoRestart is on). Keep it above the worker's
   * server-side `SATAN_MAX_TIME_MS` so the DB budget normally trips first with a
   * clean error and no recycle.
   */
  queryTimeoutMs?: number;
  /** Informational callback fired on each crash, BEFORE the restart. */
  onCrash?: (code: number | null, signal: NodeJS.Signals | null) => void;
}

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

  private readonly pythonBin: string;
  private readonly workerPath: string;
  private readonly cwd?: string;
  private readonly childEnv?: NodeJS.ProcessEnv;
  private autoRestart: boolean;
  private readonly queryTimeoutMs: number;
  private readonly onCrash?: SatanClientOptions["onCrash"];

  constructor(opts: SatanClientOptions = {}) {
    super();
    this.pythonBin = opts.pythonBin ?? "python3";
    this.queryTimeoutMs = opts.queryTimeoutMs ?? 8000;
    // Default assumes the shipped layout:
    //   packages/satan/dist/SatanClient.js   (this file, after build)
    //   packages/satan/python/worker.py
    this.workerPath = opts.workerPath ?? path.resolve(__dirname, "..", "python", "worker.py");
    this.cwd = opts.cwd;
    this.autoRestart = opts.autoRestart ?? true;
    this.onCrash = opts.onCrash;

    // Forward the Mongo target to the worker via env (strings only — no driver).
    if (opts.mongoUrl || opts.mongoDb || opts.env) {
      this.childEnv = {
        ...(opts.env ?? process.env),
        ...(opts.mongoUrl ? { MONGODB_URL: opts.mongoUrl } : {}),
        ...(opts.mongoDb ? { MONGODB_DB: opts.mongoDb } : {}),
      };
    }
  }

  /** Starts the worker if it isn't already running. Idempotent. */
  start(): void {
    if (this.proc || this.closed) return;

    const proc = spawn(this.pythonBin, [this.workerPath], {
      cwd: this.cwd,
      env: this.childEnv,
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
      for (const [, p] of this.pending) {
        if (p.timer) clearTimeout(p.timer);
        p.reject(err);
      }
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
   * Runs a SATAN QL query through the worker and resolves its result:
   * `FIND` → the matching documents (with `_id` renamed to `id`), `INSERT` →
   * `{ insertedId }`, `UPDATE` → `{ matchedCount, modifiedCount }`, `DELETE` →
   * `{ deletedCount }`.
   * @throws SatanQueryError if the worker rejects the query.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query(ql: string): Promise<any> {
    if (this.closed) {
      return Promise.reject(new SatanQueryError("SatanClient already closed"));
    }
    if (!this.proc) this.start();

    const id = randomUUID();
    const payload = JSON.stringify({ id, query: ql }) + "\n";

    return new Promise((resolve, reject) => {
      const timer =
        this.queryTimeoutMs > 0
          ? setTimeout(() => {
              if (!this.pending.delete(id)) return;
              reject(new SatanQueryError(`SATAN query timed out after ${this.queryTimeoutMs}ms`));
              // The worker runs one query at a time, so it's stuck on this one —
              // force-recycle it (SIGKILL) so queued queries don't hang behind it.
              this.recycleWorker();
            }, this.queryTimeoutMs)
          : undefined;
      this.pending.set(id, { resolve, reject, timer });
      this.proc!.stdin.write(payload, (err) => {
        if (err && this.pending.delete(id)) {
          if (timer) clearTimeout(timer);
          reject(err);
        }
      });
    });
  }

  /** SIGKILL the current worker; the `exit` handler rejects any still-pending
   *  queries and autoRestart (when enabled) starts a fresh one. */
  private recycleWorker(): void {
    this.proc?.kill("SIGKILL");
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
      if (!pending) continue; // orphan response (e.g. a timed-out query), ignored
      this.pending.delete(resp.id);
      if (pending.timer) clearTimeout(pending.timer);

      if (resp.ok) {
        pending.resolve(resp.result);
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
