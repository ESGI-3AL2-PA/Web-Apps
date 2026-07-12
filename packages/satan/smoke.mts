/**
 * End-to-end smoke test: spawns the real Python worker through SatanClient and
 * asserts each CRUD op translates as expected, plus a malformed-query rejection.
 *
 * Run (after `npm run build -w @repo/satan`) with a Python that has `ply`:
 *   SATAN_PYTHON=packages/satan/.venv/bin/python \
 *     npx tsx packages/satan/smoke.mts
 *
 * Not part of the shipped build (excluded from tsconfig `include`).
 */

import assert from "node:assert/strict";

import { createSatanClient, SatanQueryError } from "./dist/index.js";

const client = createSatanClient({
  pythonBin: process.env.SATAN_PYTHON ?? "python3",
  autoRestart: false,
});
client.on("stderr", (line: string) => process.stderr.write(`[worker] ${line}`));

async function main(): Promise<void> {
  const find = await client.query(
    'FIND users WHERE role = "admin" AND name LIKE "Jo*" LIMIT 10 ORDER BY createdAt DESC',
  );
  assert.deepEqual(find, {
    op: "find",
    collection: "users",
    filter: { $and: [{ role: "admin" }, { name: { $regex: "^Jo.*$" } }] },
    limit: 10,
    sort: [["createdAt", -1]],
  });

  const insert = await client.query('INSERT INTO users SET name = "John", age = 30');
  assert.deepEqual(insert, {
    op: "insertOne",
    collection: "users",
    document: { name: "John", age: 30 },
  });

  const update = await client.query("UPDATE products SET price = 9.99 WHERE id = 5");
  assert.deepEqual(update, {
    op: "updateMany",
    collection: "products",
    filter: { id: 5 },
    update: { $set: { price: 9.99 } },
  });

  const del = await client.query('DELETE FROM users WHERE role = "guest"');
  assert.deepEqual(del, {
    op: "deleteMany",
    collection: "users",
    filter: { role: "guest" },
  });

  await assert.rejects(() => client.query("FIND WHERE"), SatanQueryError);

  console.warn("✓ all SATAN QL smoke assertions passed");
}

main()
  .then(() => client.close())
  .catch(async (err) => {
    await client.close();
    console.error(err);
    process.exit(1);
  });
