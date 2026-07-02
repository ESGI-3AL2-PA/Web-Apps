#!/usr/bin/env bash
# Nightly DB backup for the prod stack. Run on the VPS (cron installs it at 04:00,
# see scripts/provision.sh). Writes to ./backups and prunes anything older than
# RETENTION_DAYS.
#
#   ./scripts/backup.sh              # RETENTION_DAYS defaults to 7
#
# Mongo is dumped online (safe on a running server). Neo4j Community has no online
# backup, so it is briefly stopped, dumped, and restarted (~seconds of downtime).
set -euo pipefail

cd "$(dirname "$0")/.."

RETENTION_DAYS="${RETENTION_DAYS:-7}"
COMPOSE="docker compose -f docker-compose.prod.yml"
STAMP="$(date +%Y%m%d-%H%M%S)"
MONGO_DIR="backups/mongo"
NEO4J_DIR="backups/neo4j"
mkdir -p "$MONGO_DIR" "$NEO4J_DIR"

echo "▸ [$STAMP] Mongo dump (online)…"
$COMPOSE exec -T mongodb sh -c \
  'mongodump --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --archive --gzip' \
  > "$MONGO_DIR/mongo-$STAMP.archive.gz"
echo "  → $MONGO_DIR/mongo-$STAMP.archive.gz ($(du -h "$MONGO_DIR/mongo-$STAMP.archive.gz" | cut -f1))"

echo "▸ [$STAMP] Neo4j dump (stop → dump → start)…"
out="$NEO4J_DIR/$STAMP"
mkdir -p "$out"
chmod 777 "$out" # neo4j-admin runs as uid 7474 inside the container
$COMPOSE stop neo4j
# One-off container on the neo4j service (inherits the neo4j_data volume at /data);
# add a bind mount for the dump output.
$COMPOSE run --rm --no-deps -v "$PWD/$out:/backup" neo4j \
  neo4j-admin database dump neo4j --to-path=/backup --overwrite-destination=true
$COMPOSE start neo4j
echo "  → $out/neo4j.dump"

echo "▸ Pruning backups older than ${RETENTION_DAYS} days…"
find "$MONGO_DIR" -name 'mongo-*.archive.gz' -mtime "+$RETENTION_DAYS" -print -delete || true
find "$NEO4J_DIR" -mindepth 1 -maxdepth 1 -type d -mtime "+$RETENTION_DAYS" -exec rm -rf {} + || true

echo "✓ [$STAMP] Backup complete."
