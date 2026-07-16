#!/usr/bin/env bash
#
# backup.sh — point-in-time backup of every Connected NeighBours data store:
#
#   • MongoDB  (app database)                          → mongodump gzip archive
#   • Neo4j    (graph projection / recommendations)    → neo4j-admin database dump
#   • MinIO/S3 (voice messages, listing images,        → mc mirror (per bucket)
#               Documenso PDFs)
#
# Everything lands under a single timestamped directory:
#
#   $BACKUP_DIR/<UTC-timestamp>/
#     ├── mongo/<db>.archive.gz
#     ├── neo4j/<database>.dump
#     └── minio/<bucket>/...
#
# Connection settings reuse the .env.dist variable names, so sourcing your env is
# all the configuration you need:
#
#   set -a; . ./.env; set +a
#   ./scripts/backup.sh
#
# Run modes (USE_DOCKER):
#   USE_DOCKER=0  (default) — tools run on the host; `mongodump`, `neo4j-admin`
#                             and `mc` must be on PATH.
#   USE_DOCKER=1            — tools run against the compose stack (no host tooling
#                             needed). Mongo dumps via `docker compose exec`; Neo4j
#                             and MinIO via one-off `docker compose run` containers
#                             that reuse the service images/volumes/network.
#
# NOTE: a Neo4j Community dump is an *offline* operation — the store must be
# stopped. In docker mode this script stops the `neo4j` service, dumps, then
# starts it again. On the host, stop your Neo4j instance before running.
#
set -euo pipefail

# ── Config (env-driven, .env.dist names reused) ──────────────────────────────
MONGODB_URL="${MONGODB_URL:-mongodb://root:root@localhost:27017}"
MONGODB_DB="${MONGODB_DB:-db}"

NEO4J_DATABASE="${NEO4J_DATABASE:-neo4j}"   # Community default DB name
# NEO4J_USER / NEO4J_PASSWORD are not needed for an offline dump but are honoured
# by restore.sh and any online verification step.

# Object store — both app buckets live in the same MinIO instance; reuse the
# MESSAGES_MINIO_* credentials as the canonical ones.
MINIO_ENDPOINT="${MESSAGES_MINIO_ENDPOINT:-http://localhost:9000}"
MINIO_ACCESS_KEY="${MESSAGES_MINIO_ACCESS_KEY:-minioadmin}"
MINIO_SECRET_KEY="${MESSAGES_MINIO_SECRET_KEY:-minioadmin}"
# Buckets to back up (space-separated). Defaults match the compose init job.
BACKUP_BUCKETS="${BACKUP_BUCKETS:-messages listings documenso}"

BACKUP_DIR="${BACKUP_DIR:-./backups}"
USE_DOCKER="${USE_DOCKER:-0}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="${BACKUP_DIR%/}/${TIMESTAMP}"

usage() {
  sed -n '2,40p' "$0"
  exit "${1:-0}"
}
case "${1:-}" in -h | --help | help) usage 0 ;; esac

compose() { docker compose -f "$COMPOSE_FILE" "$@"; }

log() { printf '[backup] %s\n' "$*" >&2; }

# ── Mongo ────────────────────────────────────────────────────────────────────
backup_mongo() {
  local dest="${OUT_DIR}/mongo/${MONGODB_DB}.archive.gz"
  mkdir -p "${OUT_DIR}/mongo"
  log "MongoDB → ${dest}"
  if [ "$USE_DOCKER" = "1" ]; then
    # mongodump streams the archive to stdout; -T disables TTY so the pipe is clean.
    compose exec -T mongodb \
      mongodump --uri="$MONGODB_URL" --db="$MONGODB_DB" --archive --gzip >"$dest"
  else
    mongodump --uri="$MONGODB_URL" --db="$MONGODB_DB" --archive="$dest" --gzip
  fi
}

# ── Neo4j (offline dump) ─────────────────────────────────────────────────────
backup_neo4j() {
  mkdir -p "${OUT_DIR}/neo4j"
  log "Neo4j → ${OUT_DIR}/neo4j/${NEO4J_DATABASE}.dump"
  if [ "$USE_DOCKER" = "1" ]; then
    log "stopping neo4j service for offline dump"
    compose stop neo4j
    # One-off container on the neo4j image; it inherits the neo4j_data volume from
    # the service definition, and we bind-mount the host output dir at /backups.
    compose run --rm --no-deps \
      -v "$(pwd)/${OUT_DIR}/neo4j:/backups" \
      neo4j \
      neo4j-admin database dump "$NEO4J_DATABASE" --to-path=/backups --overwrite-destination=true
    log "restarting neo4j service"
    compose start neo4j
  else
    # Host mode: Neo4j must already be stopped.
    neo4j-admin database dump "$NEO4J_DATABASE" \
      --to-path="${OUT_DIR}/neo4j" --overwrite-destination=true
  fi
}

# ── MinIO / S3 buckets ───────────────────────────────────────────────────────
backup_minio() {
  mkdir -p "${OUT_DIR}/minio"
  log "MinIO buckets: ${BACKUP_BUCKETS}"
  if [ "$USE_DOCKER" = "1" ]; then
    # Run the mc client image on the compose network; `minio` resolves in-network.
    local endpoint="${MINIO_ENDPOINT}"
    case "$endpoint" in *localhost* | *127.0.0.1*) endpoint="http://minio:9000" ;; esac
    compose run --rm --no-deps -T \
      -v "$(pwd)/${OUT_DIR}/minio:/backup" \
      --entrypoint sh \
      minio-createbucket -c "
        set -e
        mc alias set src '${endpoint}' '${MINIO_ACCESS_KEY}' '${MINIO_SECRET_KEY}'
        for b in ${BACKUP_BUCKETS}; do
          echo \"mirror \$b\" >&2
          mc mirror --overwrite --remove \"src/\$b\" \"/backup/\$b\"
        done
      "
  else
    mc alias set cnb-backup "$MINIO_ENDPOINT" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY"
    local b
    for b in $BACKUP_BUCKETS; do
      log "mirror ${b}"
      mc mirror --overwrite --remove "cnb-backup/${b}" "${OUT_DIR}/minio/${b}"
    done
  fi
}

main() {
  mkdir -p "$OUT_DIR"
  log "starting backup → ${OUT_DIR} (USE_DOCKER=${USE_DOCKER})"
  backup_mongo
  backup_neo4j
  backup_minio
  log "backup complete: ${OUT_DIR}"
}

main "$@"
