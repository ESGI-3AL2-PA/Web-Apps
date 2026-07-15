/**
 * Minimal, forward-only MongoDB migration runner.
 *
 * This is a *convention + runner*, deliberately not a migration framework:
 *   - Migrations live in `apps/api/src/migrations/` and are named `NNN-description.ts`
 *     (zero-padded numeric prefix — ordering is a lexicographic sort on the name).
 *   - Each migration module exports an async `up(db)` and, optionally, `down(db)`.
 *   - Applied migrations are recorded in the `_migrations` collection (one document
 *     per migration, `_id` = the file name without extension). Anything not recorded
 *     there is considered pending and is run in order.
 *
 * Connection settings come from the same env vars the app uses (MONGODB_URL /
 * MONGODB_DB) via the shared connector, so no extra configuration is needed.
 *
 * Usage:
 *   npm run migrate          -w api   # apply all pending migrations
 *   npm run migrate:status   -w api   # list migrations and their state
 *   npm run migrate:down     -w api   # roll back the most recent migration
 *   tsx src/scripts/migrate.ts up     # (equivalent, run directly)
 *
 * In dev the migrations run as `.ts` via tsx; after `tsc` they run as the compiled
 * `.js` in `dist/migrations` — the runner resolves whichever sits next to it.
 */

import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Collection, Db } from "mongodb";
import { closeDB, connectDB } from "../repositories/mongodb.connector.js";

/** Shape every migration file must satisfy (re-export `up`/`down` as named exports). */
export interface Migration {
  up: (db: Db) => Promise<void>;
  down?: (db: Db) => Promise<void>;
}

/** A row in the `_migrations` ledger. `_id` is the migration file name (no ext). */
interface MigrationRecord {
  _id: string;
  appliedAt: Date;
}

const MIGRATIONS_COLLECTION = "_migrations";

// Typed accessor so `_id` is a string (the driver otherwise defaults it to ObjectId).
const ledger = (db: Db): Collection<MigrationRecord> => db.collection<MigrationRecord>(MIGRATIONS_COLLECTION);
const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../migrations");

// NNN-description.(ts|js). Skip declaration/test/map siblings a build might drop.
const FILE_RE = /^\d+-.+\.(ts|js)$/;

const nameOf = (file: string): string => file.replace(/\.(ts|js)$/, "");

const listMigrationFiles = async (): Promise<string[]> => {
  const entries = await readdir(migrationsDir);
  return entries
    .filter((f) => FILE_RE.test(f) && !f.endsWith(".d.ts") && !f.includes(".test."))
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
};

const appliedNames = async (db: Db): Promise<Set<string>> => {
  const docs = await ledger(db)
    .find({}, { projection: { _id: 1 } })
    .toArray();
  return new Set(docs.map((d) => d._id));
};

const loadMigration = async (file: string): Promise<Migration> => {
  const mod: Partial<Migration> = await import(path.join(migrationsDir, file));
  if (typeof mod.up !== "function") {
    throw new Error(`Migration "${file}" does not export an "up" function`);
  }
  return mod as Migration;
};

const runUp = async (db: Db): Promise<void> => {
  const done = await appliedNames(db);
  const pending = (await listMigrationFiles()).filter((f) => !done.has(nameOf(f)));

  if (pending.length === 0) {
    console.warn("[migrate] up: nothing to do (all migrations applied)");
    return;
  }

  for (const file of pending) {
    const name = nameOf(file);
    const migration = await loadMigration(file);
    console.warn(`[migrate] applying ${name}`);
    await migration.up(db);
    await ledger(db).insertOne({ _id: name, appliedAt: new Date() });
    console.warn(`[migrate] applied  ${name}`);
  }
  console.warn(`[migrate] up: applied ${pending.length} migration(s)`);
};

const runDown = async (db: Db): Promise<void> => {
  // Roll back only the most recently applied migration. `_id` is the zero-padded
  // name, so a descending sort on it yields the latest.
  const [last] = await ledger(db).find({}).sort({ _id: -1 }).limit(1).toArray();
  if (!last) {
    console.warn("[migrate] down: nothing to roll back");
    return;
  }

  const name = last._id;
  const file = (await listMigrationFiles()).find((f) => nameOf(f) === name);
  if (!file) {
    throw new Error(`Applied migration "${name}" has no matching file — cannot roll back`);
  }

  const migration = await loadMigration(file);
  if (!migration.down) {
    throw new Error(`Migration "${name}" has no "down" — cannot roll back`);
  }

  console.warn(`[migrate] reverting ${name}`);
  await migration.down(db);
  await ledger(db).deleteOne({ _id: last._id });
  console.warn(`[migrate] reverted ${name}`);
};

const runStatus = async (db: Db): Promise<void> => {
  const done = await appliedNames(db);
  const files = await listMigrationFiles();
  if (files.length === 0) {
    console.warn("[migrate] no migration files found");
    return;
  }
  for (const file of files) {
    const name = nameOf(file);
    console.warn(`${done.has(name) ? "applied" : "pending"}\t${name}`);
  }
};

const main = async (): Promise<void> => {
  const cmd = process.argv[2] ?? "up";
  const db = await connectDB();
  try {
    if (cmd === "up") {
      await runUp(db);
    } else if (cmd === "down") {
      await runDown(db);
    } else if (cmd === "status") {
      await runStatus(db);
    } else {
      console.error(`Unknown command "${cmd}". Usage: migrate [up|down|status]`);
      process.exitCode = 1;
    }
  } finally {
    await closeDB();
  }
};

main().catch((err: unknown) => {
  console.error("[migrate] failed:", err);
  process.exitCode = 1;
});
