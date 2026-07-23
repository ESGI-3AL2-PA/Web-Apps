/**
 * Runner de migrations MongoDB minimal, uniquement forward (pas de rejeu arrière
 * automatique au-delà du dernier down).
 *
 * C'est une *convention + un runner*, délibérément pas un framework de migration :
 *   - Les migrations vivent dans `apps/api/src/migrations/` et sont nommées
 *     `NNN-description.ts` (préfixe numérique zéro-paddé — l'ordre est un tri
 *     lexicographique sur le nom).
 *   - Chaque module de migration exporte un `up(db)` async et, optionnellement, `down(db)`.
 *   - Les migrations appliquées sont enregistrées dans la collection `_migrations`
 *     (un document par migration, `_id` = nom de fichier sans extension). Tout ce
 *     qui n'y figure pas est considéré comme en attente et exécuté dans l'ordre.
 *
 * Les paramètres de connexion viennent des mêmes variables d'env que l'app
 * (MONGODB_URL / MONGODB_DB) via le connecteur partagé — aucune configuration en plus.
 *
 * Usage :
 *   npm run migrate          -w api   # applique toutes les migrations en attente
 *   npm run migrate:status   -w api   # liste les migrations et leur état
 *   npm run migrate:down     -w api   # annule la migration la plus récente
 *   tsx src/scripts/migrate.ts up     # (équivalent, exécution directe)
 *
 * En dev les migrations tournent en `.ts` via tsx ; après `tsc` elles tournent en
 * `.js` compilé dans `dist/migrations` — le runner résout celles qui sont à côté de lui.
 */

import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Collection, Db } from "mongodb";
import { closeDB, connectDB } from "../repositories/mongodb.connector.js";

/** Forme que tout fichier de migration doit respecter (exports nommés `up`/`down`). */
export interface Migration {
  up: (db: Db) => Promise<void>;
  down?: (db: Db) => Promise<void>;
}

/** Une ligne du registre `_migrations`. `_id` est le nom de fichier (sans extension). */
interface MigrationRecord {
  _id: string;
  appliedAt: Date;
}

const MIGRATIONS_COLLECTION = "_migrations";

// Accesseur typé pour que `_id` soit une chaîne (sinon le driver le typerait ObjectId).
const ledger = (db: Db): Collection<MigrationRecord> => db.collection<MigrationRecord>(MIGRATIONS_COLLECTION);
// Répertoire des migrations, résolu relativement à ce fichier (marche en .ts comme en .js).
const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../migrations");

// NNN-description.(ts|js). Écarte les fichiers .d.ts / .test / .map qu'un build pourrait déposer.
const FILE_RE = /^\d+-.+\.(ts|js)$/;

const nameOf = (file: string): string => file.replace(/\.(ts|js)$/, "");

// Liste les fichiers de migration valides, triés numériquement par préfixe NNN.
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

// Importe dynamiquement un module de migration et vérifie qu'il expose bien `up`.
const loadMigration = async (file: string): Promise<Migration> => {
  const mod: Partial<Migration> = await import(path.join(migrationsDir, file));
  if (typeof mod.up !== "function") {
    throw new Error(`Migration "${file}" does not export an "up" function`);
  }
  return mod as Migration;
};

// Applique dans l'ordre toutes les migrations non encore enregistrées, en inscrivant
// chacune au registre après son `up` (pas de transaction : un up doit être robuste).
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

// Annule uniquement la dernière migration appliquée.
const runDown = async (db: Db): Promise<void> => {
  // `_id` est le nom zéro-paddé, donc un tri décroissant dessus donne la plus récente.
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

// Affiche, pour chaque fichier de migration, s'il est `applied` ou `pending`.
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

// Point d'entrée : dispatch selon la sous-commande (up | down | status), défaut `up`.
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
