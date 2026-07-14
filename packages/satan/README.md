# @repo/satan

**SATAN QL** — a small SQL-like query language over MongoDB. A Python lex/yacc
(PLY) worker parses, translates **and runs** the query against Mongo (pymongo);
Node spawns that process once, keeps it alive, and talks newline-delimited JSON
over stdin/stdout.

> SATAN = **S**ananes **A**byssal **T**orment **A**nalysis **N**etwork

This TypeScript package is a **thin subprocess bridge** — it starts the worker
and exposes `query()`. It does **not** import or depend on the Mongo driver; the
worker owns the database connection. You tell it which database via `mongoUrl` /
`mongoDb` (forwarded to the worker as `MONGODB_URL` / `MONGODB_DB` env vars).
Best-effort, low-expectation: `query()` returns `any`.

## Usage

```ts
import { createSatanClient, quote } from "@repo/satan";

const satan = createSatanClient({
  mongoUrl: process.env.MONGODB_URL, // where the worker connects
  mongoDb: process.env.MONGODB_DB,
});

// query() runs the query in the worker and returns the result:
const users = await satan.query('FIND users WHERE role = "admin" LIMIT 10');
// → [{ id, email, role, ... }, ...]   (find: docs, with _id renamed to id)

// build queries safely with quote():
const one = await satan.query(`FIND users WHERE _id = ${quote(id)}`);

await satan.close(); // on shutdown
```

`query(ql)` returns, by op:

| op       | returns                           |
| -------- | --------------------------------- |
| `FIND`   | array of documents (`_id` → `id`) |
| `COUNT`  | `{ count }`                       |
| `INSERT` | `{ insertedId }`                  |
| `UPDATE` | `{ matchedCount, modifiedCount }` |
| `DELETE` | `{ deletedCount }`                |

A rejected query throws `SatanQueryError` (Python trace on `.pythonTrace`). The
worker restarts on crash unless `autoRestart: false`.

## Query language

```
FIND <coll> [WHERE <expr>] [SELECT f, …] [ORDER BY f [ASC|DESC], …] [SKIP n] [LIMIT n]
COUNT <coll> [WHERE <expr>]
INSERT INTO <coll> SET f = v, …
UPDATE <coll> SET f = v, … [WHERE <expr>]
DELETE FROM <coll> [WHERE <expr>]
```

`<expr>`: `AND` / `OR` / `NOT` with parentheses; conditions use `= != < > <= >=`,
`LIKE "a*b?"` (anchored, case-sensitive; `*` = any chars, `?` = one char),
`ILIKE "a*b?"` (same, case-insensitive), `IEQ "text"` (case-insensitive literal
equality — anchored, `*`/`?` stay literal), `CONTAINS "text"` (case-insensitive
literal substring — the search-box operator), `IN (…)`, `EXISTS`. Values are
strings, numbers, `TRUE`, `FALSE`, `NULL`. Field paths may be dotted
(`profile.address.city`). Keywords are case-insensitive.

The worker caps read ops (`find`/`count`) with `SATAN_MAX_TIME_MS` (default
`5000`) so a heavy filter can't pin Mongo; the Node client applies a per-query
backstop timeout (`queryTimeoutMs`, default `8000`) that recycles a stuck worker.

## Runtime requirement

The worker shells out to **`python3`** with **`ply`** (parsing) and **`pymongo`**
(execution) installed. Neither is bundled — wherever this package runs you must
provide them, plus a reachable Mongo (`MONGODB_URL` / `MONGODB_DB`).

- **Local dev** (Nix python is externally-managed, so use a venv):
  ```bash
  python3 -m venv packages/satan/.venv
  packages/satan/.venv/bin/pip install -r packages/satan/python/requirements.txt
  ```
  then point the client at it via `createSatanClient({ pythonBin: ".../.venv/bin/python" })`.
- **Docker (`apps/api`, `node:*-alpine`)**: the image has no Python. The api image
  adds `python3` + a venv with `ply` + `pymongo` (see `apps/api/Dockerfile`).

## Scripts

- `npm run build -w @repo/satan` — compile `src` → `dist`
- `npm run test:py -w @repo/satan` — Python parse/translate unit checks (no Mongo)
- `npm run install:py -w @repo/satan` — `pip install -r python/requirements.txt`
- smoke (needs `ply`+`pymongo`+Mongo): `MONGODB_URL=… SATAN_PYTHON=packages/satan/.venv/bin/python npx tsx packages/satan/smoke.mts`
