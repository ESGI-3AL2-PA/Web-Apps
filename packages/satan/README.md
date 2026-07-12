# @repo/satan

**SATAN QL** — a small SQL-like query language compiled to MongoDB operation
descriptors. Parsing is done by a Python lex/yacc (PLY) process that Node spawns
once and keeps alive, talking newline-delimited JSON over stdin/stdout.

> SATAN = **S**ananes **A**byssal **T**orment **A**nalysis **N**etwork

This package **only translates** SATAN QL into a serializable Mongo op
descriptor — it never touches the Mongo driver. The consumer (e.g. `apps/api`)
executes the descriptor.

## Usage

```ts
import { createSatanClient } from "@repo/satan";

const satan = createSatanClient(); // spawns python3 python/worker.py, kept alive

const op = await satan.query('FIND users WHERE role = "admin" LIMIT 10');
// → { op: "find", collection: "users", filter: { role: "admin" }, limit: 10 }

// ...drive the Mongo driver from `op` in the repository layer...

await satan.close(); // on shutdown
```

`query()` returns a `SatanOp`:

| `op`         | Fields                                                  |
| ------------ | ------------------------------------------------------- |
| `find`       | `collection, filter, projection?, sort?, limit?, skip?` |
| `insertOne`  | `collection, document`                                  |
| `updateMany` | `collection, filter, update: { $set }`                  |
| `deleteMany` | `collection, filter`                                    |

A rejected query throws `SatanQueryError` (with the Python trace on
`.pythonTrace`). The worker restarts automatically on crash unless
`autoRestart: false`.

## Query language

```
FIND <coll> [WHERE <expr>] [SELECT f, …] [ORDER BY f [ASC|DESC], …] [SKIP n] [LIMIT n]
INSERT INTO <coll> SET f = v, …
UPDATE <coll> SET f = v, … [WHERE <expr>]
DELETE FROM <coll> [WHERE <expr>]
```

`<expr>`: `AND` / `OR` / `NOT` with parentheses; conditions use `= != < > <= >=`,
`LIKE "a*b?"` (`*` = any chars, `?` = one char), `IN (…)`, `EXISTS`. Values are
strings, numbers, `TRUE`, `FALSE`, `NULL`. Field paths may be dotted
(`profile.address.city`). Keywords are case-insensitive.

## Runtime requirement

The client shells out to **`python3`** with the **`ply`** package installed. This
is not bundled — wherever this package runs you must provide both.

- **Local dev** (Nix python is externally-managed, so use a venv):
  ```bash
  python3 -m venv packages/satan/.venv
  packages/satan/.venv/bin/pip install ply
  ```
  then point the client at it via `createSatanClient({ pythonBin: ".../.venv/bin/python" })`.
- **Docker (`apps/api`, `node:*-alpine`)**: the image has no Python. When this
  package is integrated, the api image must add `python3` + `ply`
  (e.g. `apk add --no-cache python3 py3-ply`, or `python3` + `pip install ply`).

## Scripts

- `npm run build -w @repo/satan` — compile `src` → `dist`
- `npm run test:py -w @repo/satan` — Python parse/translate unit checks
- `npm run install:py -w @repo/satan` — `pip install -r python/requirements.txt`
- smoke (needs `ply`): `SATAN_PYTHON=packages/satan/.venv/bin/python npx tsx packages/satan/smoke.mts`
