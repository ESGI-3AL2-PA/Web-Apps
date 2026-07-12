/**
 * Smoke test for @repo/satan. The worker executes against Mongo, so this needs a
 * database: set MONGODB_URL (and optionally MONGODB_DB) to run it, otherwise it
 * skips. Parse/translate is covered Mongo-free by python/test_satan.py.
 *
 * Run (after `npm run build -w @repo/satan`, with a Python that has ply+pymongo):
 *   MONGODB_URL=mongodb://root:root@localhost:27017 MONGODB_DB=db \
 *     SATAN_PYTHON=packages/satan/.venv/bin/python npx tsx packages/satan/smoke.mts
 *
 * Not part of the shipped build (excluded from tsconfig `include`).
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
  const rows = await client.query("FIND users LIMIT 1");
  assert.ok(Array.isArray(rows), "FIND should return an array");
  console.warn(`✓ FIND users LIMIT 1 → ${rows.length} row(s)`);

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
