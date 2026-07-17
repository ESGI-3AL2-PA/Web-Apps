# Ops scripts: backup, restore, migrations

Addresses finding **deploy-M12** — data previously lived only in named Docker
volumes (a lost volume = total data loss), Mongo used the raw driver with no
migration tooling, and Neo4j had no schema/versioning tooling. This directory
adds a backup/restore pair plus a lightweight, forward-only Mongo migration
convention. It is a **scaffold**, not a full framework.

## Backup / restore

`backup.sh` and `restore.sh` cover all three stateful stores:

| Store    | Backup                      | Restore                     |
| -------- | --------------------------- | --------------------------- |
| MongoDB  | `mongodump` (gzip archive)  | `mongorestore --drop`       |
| Neo4j    | `neo4j-admin database dump` | `neo4j-admin database load` |
| MinIO/S3 | `mc mirror` per bucket      | `mc mirror` back per bucket |

Output layout (timestamped, UTC):

```
backups/20260714T031500Z/
  mongo/db.archive.gz
  neo4j/neo4j.dump
  minio/<bucket>/...
```

### Configuration

Both scripts are env-driven and reuse the `.env.dist` variable names, so sourcing
your env is all the setup needed:

```bash
set -a; . ./.env; set +a
```

Relevant vars: `MONGODB_URL`, `MONGODB_DB`, `NEO4J_USER`, `NEO4J_PASSWORD`,
`MESSAGES_MINIO_ENDPOINT` / `MESSAGES_MINIO_ACCESS_KEY` / `MESSAGES_MINIO_SECRET_KEY`.
Backup-only knobs: `BACKUP_DIR` (default `./backups`), `NEO4J_DATABASE` (default
`neo4j`), `BACKUP_BUCKETS` (default `messages listings documenso`).

### Two run modes (`USE_DOCKER`)

```bash
# On the host — mongodump / neo4j-admin / mc must be on PATH:
./scripts/backup.sh
./scripts/restore.sh ./backups/20260714T031500Z

# Against the compose stack — no host tooling needed. Mongo dumps via
# `docker compose exec`; Neo4j + MinIO via one-off `docker compose run`
# containers that reuse the service images/volumes/network:
USE_DOCKER=1 ./scripts/backup.sh
USE_DOCKER=1 ./scripts/restore.sh ./backups/20260714T031500Z
```

`COMPOSE_FILE` defaults to `docker-compose.yml` (dev); set it to
`docker-compose.deploy.yml` for the prod stack.

> **Neo4j is an offline dump/load.** Community edition cannot dump a running
> store, so both scripts **stop the `neo4j` service, dump/load, then start it**
> in docker mode. On the host, stop your Neo4j instance first. Schedule backups
> in a low-traffic window.

`restore.sh` **overwrites** live data (`mongorestore --drop`, Neo4j
`--overwrite-destination`) — it is disaster-recovery / clone, not a merge.

## Migrations

Forward-only Mongo migrations live in **`apps/api/src/migrations/`** (co-located
with the api so they type-check against the mongodb driver and reuse the app's
connector — `apps/api/tsconfig.json` only compiles `src`, so a top-level dir would
not build). The runner is `apps/api/src/scripts/migrate.ts`.

Convention:

- Files are named `NNN-description.ts` (zero-padded numeric prefix → ordering).
- Each file exports `up(db)` and, optionally, `down(db)`.
- Applied migrations are recorded in the Mongo `_migrations` collection
  (`_id` = file name without extension). Pending = not yet recorded; they run in
  order on `up`.

```bash
npm run migrate         -w api    # apply all pending migrations
npm run migrate:status  -w api    # list every migration and its state
npm run migrate:down    -w api    # roll back the most recent migration
```

Add a migration by copying `001-example.ts` to the next number. Prefer idempotent
operations (e.g. `createIndex`) so a partial run can be retried, and provide
`down` when the change is reversible.
