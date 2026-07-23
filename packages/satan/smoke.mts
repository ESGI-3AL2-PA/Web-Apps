/**
 * Smoke test de @repo/satan. Le worker s'exécute contre Mongo : il faut donc une
 * base de données — définir MONGODB_URL (et éventuellement MONGODB_DB) pour le
 * lancer, sinon il est ignoré. Le parse/translate est couvert sans Mongo par
 * python/test_satan.py.
 *
 * Lancement (après `npm run build -w @repo/satan`, avec un Python muni de ply+pymongo) :
 *   MONGODB_URL=mongodb://root:root@localhost:27017 MONGODB_DB=db \
 *     SATAN_PYTHON=packages/satan/.venv/bin/python npx tsx packages/satan/smoke.mts
 *
 * Ne fait pas partie du build livré (exclu du `include` de tsconfig).
 */

import assert from "node:assert/strict";

import { createSatanClient, SatanQueryError } from "./dist/index.js";

const mongoUrl = process.env.MONGODB_URL;
if (!mongoUrl) {
  console.warn("skip: set MONGODB_URL to run the @repo/satan smoke test");
  process.exit(0);
}

const client = createSatanClient({
  mongoUrl,
  mongoDb: process.env.MONGODB_DB ?? "db",
  pythonBin: process.env.SATAN_PYTHON ?? "python3",
  autoRestart: false,
});
client.on("stderr", (line: string) => process.stderr.write(`[worker] ${line}`));

async function main(): Promise<void> {
  // FIND doit renvoyer un tableau de documents.
  const rows = await client.query("FIND users LIMIT 1");
  assert.ok(Array.isArray(rows), "FIND should return an array");
  console.warn(`✓ FIND users LIMIT 1 → ${rows.length} row(s)`);

  // COUNT doit renvoyer un objet { count }.
  const counted = await client.query("COUNT users");
  assert.ok(typeof counted?.count === "number", "COUNT should return { count }");
  console.warn(`✓ COUNT users → ${counted.count}`);

  // Une requête malformée doit être rejetée avec SatanQueryError.
  await assert.rejects(() => client.query("FIND WHERE"), SatanQueryError);
  console.warn("✓ malformed query rejects with SatanQueryError");

  console.warn("✓ @repo/satan smoke passed");
}

main()
  .then(() => client.close())
  .catch(async (err) => {
    await client.close();
    console.error(err);
    process.exit(1);
  });
