/**
 * SatanClient — fin pont Node ↔ worker.py.
 *
 * Le worker Python parse, traduit ET exécute la requête contre MongoDB puis
 * renvoie le résultat ; ce client se contente de lancer/maintenir ce process en
 * vie et de relayer les requêtes. Il ne touche JAMAIS Mongo — il n'importe jamais
 * le driver. On pointe le worker vers une base via `mongoUrl` / `mongoDb`
 * (transmis comme variables d'env).
 *
 * Cycle de vie :
 *   - Le premier `query()` lance UN process Python persistant.
 *   - `query(ql)` écrit une ligne JSON sur stdin et résout le résultat du worker.
 *   - Si le process meurt, les requêtes en attente sont rejetées et le worker
 *     redémarre automatiquement (sauf `autoRestart: false` ou après `close()`).
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

/** Options de configuration du SatanClient. */
export interface SatanClientOptions {
  /** Chaîne de connexion Mongo contre laquelle le worker exécute les requêtes
   *  (transmise au subprocess via MONGODB_URL). Omise, le worker utilise son
   *  propre env/défaut. */
  mongoUrl?: string;
  /** Nom de la base Mongo (transmis via MONGODB_DB). */
  mongoDb?: string;
  /** Binaire Python à utiliser (défaut : "python3"). */
  pythonBin?: string;
  /** Chemin absolu de worker.py (défaut : ../python/worker.py relatif à dist/). */
  workerPath?: string;
  /** cwd du process enfant. */
  cwd?: string;
  /** env du process enfant (par défaut, hérite de process.env). */
  env?: NodeJS.ProcessEnv;
  /** Redémarre automatiquement le worker en cas de crash (défaut : true). */
  autoRestart?: boolean;
  /**
   * Timeout de sécurité par requête en ms (défaut : 8000 ; 0 désactive). Le worker
   * n'exécute qu'une requête à la fois : une requête bloquée figerait toute la
   * file — au timeout la requête en attente est rejetée et le worker est recyclé
   * de force (un neuf démarre si autoRestart est actif). À garder au-dessus du
   * `SATAN_MAX_TIME_MS` côté serveur du worker, pour que le budget DB déclenche
   * normalement en premier, avec une erreur propre et sans recyclage.
   */
  queryTimeoutMs?: number;
  /** Callback informatif déclenché à chaque crash, AVANT le redémarrage. */
  onCrash?: (code: number | null, signal: NodeJS.Signals | null) => void;
}

/**
 * Émet :
 *   - "stderr" (string)       : ligne stderr brute du worker
 *   - "error"  (Error)        : protocole rompu (JSON invalide, etc.)
 *   - "exit"   (code, signal) : worker terminé
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
    // Le défaut suppose la disposition livrée :
    //   packages/satan/dist/SatanClient.js   (ce fichier, après build)
    //   packages/satan/python/worker.py
    this.workerPath = opts.workerPath ?? path.resolve(__dirname, "..", "python", "worker.py");
    this.cwd = opts.cwd;
    this.autoRestart = opts.autoRestart ?? true;
    this.onCrash = opts.onCrash;

    // Transmet la cible Mongo au worker via l'env (chaînes seulement — pas de driver).
    if (opts.mongoUrl || opts.mongoDb || opts.env) {
      this.childEnv = {
        ...(opts.env ?? process.env),
        ...(opts.mongoUrl ? { MONGODB_URL: opts.mongoUrl } : {}),
        ...(opts.mongoDb ? { MONGODB_DB: opts.mongoDb } : {}),
      };
    }
  }

  /** Démarre le worker s'il ne tourne pas déjà. Idempotent. */
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
      // Toute requête en attente est condamnée.
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
   * Exécute une requête SATAN QL via le worker et résout son résultat :
   * `FIND` → les documents correspondants (`_id` renommé en `id`), `INSERT` →
   * `{ insertedId }`, `UPDATE` → `{ matchedCount, modifiedCount }`, `DELETE` →
   * `{ deletedCount }`.
   * @throws SatanQueryError si le worker rejette la requête.
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
              // Le worker n'exécute qu'une requête à la fois : il est bloqué sur
              // celle-ci — on le recycle de force (SIGKILL) pour que les requêtes
              // en file ne restent pas coincées derrière.
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

  /** SIGKILL le worker courant ; le handler `exit` rejette les requêtes encore
   *  en attente et autoRestart (si activé) en démarre un neuf. */
  private recycleWorker(): void {
    this.proc?.kill("SIGKILL");
  }

  /** Arrête proprement le worker. Toute requête ultérieure est rejetée. */
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
  // Interne
  // -------------------------------------------------------------------------
  // Accumule le flux stdout et découpe les réponses ndjson ligne par ligne :
  // chaque ligne complète est parsée en JSON puis appariée à sa requête en attente
  // via l'id, résolvant/rejetant la Promise correspondante.
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
      if (!pending) continue; // réponse orpheline (ex. requête déjà en timeout), ignorée
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

/** Sucre syntaxique pour `new SatanClient(opts)`. */
export function createSatanClient(opts?: SatanClientOptions): SatanClient {
  return new SatanClient(opts);
}
