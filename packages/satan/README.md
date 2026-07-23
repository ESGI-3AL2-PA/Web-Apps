# @repo/satan

**SATAN QL** — un petit langage de requêtes proche du SQL au-dessus de MongoDB. Un worker Python
lex/yacc (PLY) parse, traduit **et exécute** la requête contre Mongo (`pymongo`) ; Node lance ce
process une fois, le garde vivant et échange avec lui du JSON délimité par des sauts de ligne (ndjson)
sur stdin/stdout.

> SATAN = **S**ananes **A**byssal **T**orment **A**nalysis **N**etwork

Ce package TypeScript est un **fin pont vers un subprocess** : il démarre le worker et expose
`query()`. Il n'importe pas le driver Mongo et n'en dépend pas ; c'est le worker qui possède la
connexion à la base. On lui indique quelle base viser via `mongoUrl` / `mongoDb` (transmis au worker
comme variables d'env `MONGODB_URL` / `MONGODB_DB`). Approche best-effort, à faibles garanties de
typage : `query()` renvoie `any`.

Ce README couvre **l'usage du package**. Pour le langage lui-même (grammaire, opérateurs, traduction
vers MongoDB) et l'architecture (worker, protocole ndjson, interposition dans `apps/api`), voir
[`documentation/satan-ql.md`](../../documentation/satan-ql.md).

## Usage

```ts
import { createSatanClient, quote } from "@repo/satan";

const satan = createSatanClient({
  mongoUrl: process.env.MONGODB_URL, // où le worker se connecte
  mongoDb: process.env.MONGODB_DB,
});

// query() exécute la requête dans le worker et renvoie le résultat :
const users = await satan.query('FIND users WHERE role = "admin" LIMIT 10');
// → [{ id, email, role, ... }, ...]   (find : documents, avec _id renommé en id)

// construire des requêtes sans risque avec quote() :
const one = await satan.query(`FIND users WHERE _id = ${quote(id)}`);

await satan.close(); // à l'arrêt
```

`query(ql)` renvoie, selon l'op :

| op       | renvoie                             |
| -------- | ----------------------------------- |
| `FIND`   | tableau de documents (`_id` → `id`) |
| `COUNT`  | `{ count }`                         |
| `INSERT` | `{ insertedId }`                    |
| `UPDATE` | `{ matchedCount, modifiedCount }`   |
| `DELETE` | `{ deletedCount }`                  |

Une requête rejetée lève `SatanQueryError` (stack Python sur `.pythonTrace`). Le worker redémarre en
cas de crash, sauf `autoRestart: false`.

`quote(v)` rend un scalaire JS (`string | number | boolean | null`) en littéral SATAN QL en échappant
les chaînes, pour qu'une valeur venant d'une requête ne puisse pas s'échapper de son contexte
(protection contre l'injection) ; un nombre non fini (`NaN` / `Infinity`) est refusé plutôt qu'émis.

## Garde-fous de temps

Le worker plafonne les lectures (`find` / `count`) avec `SATAN_MAX_TIME_MS` (défaut `5000`) pour qu'un
filtre coûteux ne monopolise pas Mongo ; le client Node applique en plus un timeout de sécurité par
requête (`queryTimeoutMs`, défaut `8000`) qui recycle un worker bloqué. À garder au-dessus du plafond
serveur, pour que le budget DB déclenche normalement en premier.

## Interposition dans `apps/api`

`apps/api` enveloppe ses repositories Mongo dans des homologues SATAN (les `*.repository.satan.ts`) :
en production, SATAN est ainsi interposé par défaut devant les accès en lecture, avec repli automatique
sur Mongo si le worker ne démarre pas. Détails dans
[`documentation/satan-ql.md`](../../documentation/satan-ql.md#interposition-dans-lapi).

## Prérequis d'exécution

Le worker s'appuie sur **`python3`** avec **`ply`** (parsing) et **`pymongo`** (exécution) installés.
Aucun des deux n'est embarqué — là où ce package tourne, il faut les fournir, ainsi qu'un Mongo
joignable (`MONGODB_URL` / `MONGODB_DB`).

- **Dev local** (le Python de Nix est externally-managed, donc via un venv) :
  ```bash
  python3 -m venv packages/satan/.venv
  packages/satan/.venv/bin/pip install -r packages/satan/python/requirements.txt
  ```
  puis pointer le client dessus via `createSatanClient({ pythonBin: ".../.venv/bin/python" })`.
- **Docker (`apps/api`, `node:*-alpine`)** : l'image de base n'a pas de Python. L'image de l'api ajoute
  `python3` + un venv avec `ply` + `pymongo` (voir `apps/api/Dockerfile`).

## Scripts

- `npm run build -w @repo/satan` — compile `src` → `dist`
- `npm run test:py -w @repo/satan` — checks unitaires parse/translate en Python (sans Mongo)
- `npm run install:py -w @repo/satan` — `pip install -r python/requirements.txt`
- smoke (nécessite `ply` + `pymongo` + Mongo) :
  `MONGODB_URL=… SATAN_PYTHON=packages/satan/.venv/bin/python npx tsx packages/satan/smoke.mts`
