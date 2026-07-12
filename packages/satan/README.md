# @repo/satan

**SATAN QL** — a small SQL-like query language compiled to MongoDB operation
descriptors. Parsing is done by a Python lex/yacc (PLY) process that Node spawns
once and keeps alive, talking newline-delimited JSON over stdin/stdout.

> SATAN = **S**ananes **A**byssal **T**orment **A**nalysis **N**etwork

Best-effort, low-expectation query language: give it a Mongo `Db` and it runs
your SATAN QL against it. `query()` returns `any`.

## Usage

```ts
import { createSatanClient, quote } from "@repo/satan";

const satan = createSatanClient({ db }); // db: a mongodb Db; spawns the worker, kept alive

// query() translates AND runs the query, returning results:
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
| `INSERT` | `{ insertedId }`                  |
| `UPDATE` | `{ matchedCount, modifiedCount }` |
| `DELETE` | `{ deletedCount }`                |

Need the raw translation without touching Mongo? `compile(ql)` returns the
`SatanOp` descriptor (`{ op, collection, filter, ... }`) — used by the smoke
test and the boot healthcheck. A rejected query throws `SatanQueryError` (Python
trace on `.pythonTrace`). The worker restarts on crash unless `autoRestart: false`.

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
