# SATAN QL — Langage de requêtes maison pour MongoDB

## Définition

### SATAN = **S**ananes **A**byssal **T**orment **A**nalysis **N**etwork

## Vue d'ensemble

`@repo/satan` est un package du monorepo qui introduit un langage de requêtes maison, proche du SQL
(SATAN QL), traduit en opérations MongoDB à l'exécution. L'analyse (lexer + parser) et la traduction
sont écrites en Python avec PLY (lex/yacc) ; le worker Python **exécute lui-même** la requête contre
Mongo via `pymongo` et renvoie le résultat. Node ne parle jamais à Mongo : il lance un unique process
Python au démarrage, le garde vivant et échange avec lui des requêtes JSON délimitées par des sauts de
ligne (ndjson) sur stdin/stdout.

Le package est consommé par `apps/api` à travers l'architecture en couches habituelle
(repository → cas d'usage → route). En production, les implémentations SATAN sont **interposées par
défaut devant les accès en lecture**, avec repli automatique sur Mongo si le worker ne démarre pas
(voir [Interposition dans l'api](#interposition-dans-lapi)).

Pour l'usage du package côté Node (client, options, timeouts, prérequis Python), voir
[`packages/satan/README.md`](../packages/satan/README.md). Ce document décrit **le langage** et
**l'architecture**.

---

## Le langage

### Grammaire

```
FIND <coll> [WHERE <expr>] [SELECT f, …] [ORDER BY f [ASC|DESC], …] [SKIP n] [LIMIT n]
COUNT <coll> [WHERE <expr>]
INSERT INTO <coll> SET f = v, …
UPDATE <coll> SET f = v, … [WHERE <expr>]
DELETE FROM <coll> [WHERE <expr>]
```

Les cinq statements couvrent le CRUD. Pour un `FIND`, les clauses `WHERE` / `SELECT` / `ORDER BY` /
`SKIP` / `LIMIT` sont optionnelles et acceptées dans n'importe quel ordre (en cas de doublon, la
dernière l'emporte). Les mots-clés sont insensibles à la casse (`FIND` == `find`).

`<expr>` : combinaison de conditions reliées par `AND` / `OR` / `NOT` avec parenthèses. Une condition
est l'une de :

- comparaison — `= != < > <= >=`
- `LIKE "a*b?"` — motif ancré, **sensible à la casse** (`*` = n'importe quels caractères, `?` = un
  caractère) ;
- `ILIKE "a*b?"` — comme `LIKE`, **insensible à la casse** ;
- `IEQ "text"` — égalité littérale insensible à la casse, ancrée (`*` / `?` restent littéraux) ;
- `CONTAINS "text"` — sous-chaîne littérale insensible à la casse (l'opérateur des barres de recherche) ;
- `IN (…)` — appartenance à une liste de valeurs ;
- `EXISTS` — le champ est présent.

Les valeurs sont des chaînes (guillemets doubles, échappements `\n \r \t \" \\`), des nombres (entiers
ou flottants, signe optionnel), `TRUE`, `FALSE`, `NULL`. Les chemins de champ peuvent être pointés pour
viser des documents imbriqués (`profile.address.city`).

### Exemples

```
FIND users WHERE role = "admin" AND name LIKE "Jo*" LIMIT 10 ORDER BY createdAt DESC
FIND users WHERE profile.address.city = "Paris" SELECT id, name, email
FIND users WHERE role IN ("admin", "superAdmin") AND email EXISTS
FIND users WHERE age >= 18 AND NOT (role = "user") ORDER BY name ASC, createdAt DESC SKIP 20 LIMIT 50
FIND tags WHERE name CONTAINS "vélo" ORDER BY name ASC
COUNT users WHERE role = "admin"
INSERT INTO tags SET name = "outillage", districtId = "d-42"
UPDATE users SET role = "admin" WHERE _id = "u-1"
DELETE FROM tags WHERE _id = "t-9"
```

### Traduction vers MongoDB

Le translator convertit l'AST en descripteur d'opération pymongo. Quelques choix à connaître :

- `NOT` devient `{$nor: [ … ]}` (MongoDB n'a pas d'opérateur racine `$not`).
- `LIKE` / `ILIKE` deviennent un `$regex` ancré (`^…$`) : la valeur est intégralement échappée, puis
  `*` → `.*` et `?` → `.` ; `ILIKE` ajoute `$options: "i"`.
- `IEQ` est un `$regex` ancré, valeur entièrement échappée, avec `$options: "i"`.
- `CONTAINS` est un `$regex` **non ancré**, valeur échappée, avec `$options: "i"`.
- `FIND` → `find`, `COUNT` → `countDocuments`, `INSERT` → `insertOne`, `UPDATE` → `updateMany`
  (`{$set: …}`), `DELETE` → `deleteMany`.
- Dans les résultats de `FIND`, le `_id` de Mongo est renommé en `id` (aligné sur les repositories de
  l'api).

Résultat renvoyé selon l'opération :

| op       | renvoie                             |
| -------- | ----------------------------------- |
| `FIND`   | tableau de documents (`_id` → `id`) |
| `COUNT`  | `{ count }`                         |
| `INSERT` | `{ insertedId }`                    |
| `UPDATE` | `{ matchedCount, modifiedCount }`   |
| `DELETE` | `{ deletedCount }`                  |

---

## Architecture

```
apps/api (TypeScript / Express)
        │
        │  createSatanClient()
        ▼
@repo/satan — SatanClient
        │
        │  child_process.spawn (une fois, gardé vivant)
        │  stdin  : { "id": "uuid", "query": "FIND users WHERE ..." }\n
        │  stdout : { "id": "uuid", "ok": true, "result": [...] }\n
        ▼
packages/satan/python/worker.py   (possède la connexion Mongo)
        │
        ├── lexer.py       (tokeniseur PLY)
        ├── parser.py      (grammaire PLY → AST)
        ├── translator.py  (AST → descripteur d'opération MongoDB)
        └── executor.py    (exécute l'opération via pymongo)
        │
        │  exécute la requête et renvoie le résultat sérialisé en JSON
        ▼
MongoDB
```

Le worker lit stdin ligne par ligne : pour chaque requête il enchaîne `parse` → `translate` →
`execute`, puis répond `{ id, ok, result }` en cas de succès ou `{ id, ok: false, error, trace }` en
cas d'échec (la stack Python d'origine est renvoyée pour le débogage). Le parser est pré-chargé au
démarrage pour amortir le coût des tables LALR sur la première requête. La connexion Mongo est lue
depuis l'environnement (`MONGODB_URL` / `MONGODB_DB`), que Node transmet au subprocess ; Node ne touche
jamais Mongo lui-même.

Côté Node, le premier `query()` lance le process ; s'il meurt, les requêtes en attente sont rejetées et
le worker redémarre automatiquement (sauf `autoRestart: false` ou après `close()`). Le process
s'arrête naturellement quand stdin se ferme (à la sortie de Node).

### Garde-fous de temps

Le worker exécute une seule requête à la fois. Deux plafonds évitent qu'une requête coûteuse fige la
file :

- **Côté serveur (worker)** : `SATAN_MAX_TIME_MS` (défaut `5000`) applique un `maxTimeMS` aux lectures
  (`find` / `countDocuments`), pour qu'un filtre pathologique (gros scan `$regex`) ne monopolise pas
  `mongod`. `0` désactive le plafond.
- **Côté client (Node)** : `queryTimeoutMs` (défaut `8000`) est un timeout de sécurité par requête. Au
  déclenchement, la requête en attente est rejetée et le worker est recyclé de force (SIGKILL), un neuf
  démarrant si `autoRestart` est actif. Il est gardé au-dessus de `SATAN_MAX_TIME_MS` pour que le
  budget DB déclenche normalement en premier, avec une erreur propre et sans recyclage.

---

## Interposition dans l'api

Les repositories SATAN de `apps/api` sont l'endroit où le langage sert le produit réel. Le montage
tient en trois fichiers :

- **`apps/api/src/repositories/satan.connector.ts`** — gère le worker singleton. `connectSatan()` le
  démarre et le **vérifie** avant que l'app serve du trafic en exécutant un vrai `FIND _healthcheck`,
  ce qui prouve toute la chaîne (python + `ply` + `pymongo` + accessibilité de Mongo) en une fois ; un
  timeout de 5 s transforme une dépendance manquante en erreur de démarrage claire.
- **`apps/api/src/repositories/container.ts`** — `initContainer(db, neo4jDriver, satan?)` construit
  chaque repository Mongo, puis, si un client SATAN est fourni **et** que `SATAN_REPOS` n'est pas
  `"false"`, l'enveloppe dans son homologue SATAN (`SatanUserRepository`, `SatanTagRepository`, …).
- **`apps/api/src/index.ts`** — `maybeConnectSatan()` démarre le worker en best-effort : s'il échoue
  (python/`ply` manquant, Mongo injoignable), on log un avertissement et on **retombe sur les repos
  Mongo** plutôt que de refuser de booter.

Chaque repository SATAN implémente la même interface que le repository Mongo qu'il enveloppe : il sert
via SATAN QL les opérations exprimables (recherche par id, listes `IN`, suppression par id, listage
paginé) et **délègue à Mongo** les écritures qui produisent des champs générés côté serveur. C'est ce
qui a permis de développer le langage en parallèle du produit sans le déstabiliser.

Les helpers partagés de `apps/api/src/repositories/satan.helpers.ts` gardent les listings déclaratifs :
`eq`, `containsAny`, `where` composent la clause `WHERE`, et `paginate(collection, whereClause, …)`
exécute un `COUNT` + un `FIND … SKIP … LIMIT …` et remet le résultat dans l'enveloppe
`{ data, total, page, limit }`. Toutes les valeurs passent par `quote()`, de sorte qu'aucun appelant
n'interpole de chaîne brute dans une requête (protection contre l'injection).
