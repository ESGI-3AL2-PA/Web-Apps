#!/usr/bin/env bash
#
# restore.sh — restaure une sauvegarde produite par scripts/backup.sh.
#
#   • MongoDB  ← mongorestore (supprime d'abord les collections correspondantes)
#   • Neo4j    ← neo4j-admin database load  (hors ligne — la DB doit être arrêtée)
#   • MinIO/S3 ← mc mirror réinjecté dans chaque bucket
#
# Usage :
#   set -a; . ./.env; set +a
#   ./scripts/restore.sh <répertoire-de-sauvegarde>   # ex. ./backups/20260714T031500Z
#
# Mêmes variables d'env et modes USE_DOCKER que backup.sh. ÉCRASE les données en place —
# c'est un outil de reprise après sinistre / clonage, pas de fusion.
#
#   USE_DOCKER=0 (défaut) — outils hôte (`mongorestore`, `neo4j-admin`, `mc`).
#   USE_DOCKER=1           — via la stack compose (conteneurs exec / run jetables).
#
set -euo pipefail

MONGODB_URL="${MONGODB_URL:-mongodb://root:root@localhost:27017}"
MONGODB_DB="${MONGODB_DB:-db}"
NEO4J_DATABASE="${NEO4J_DATABASE:-neo4j}"
MINIO_ENDPOINT="${MESSAGES_MINIO_ENDPOINT:-http://localhost:9000}"
MINIO_ACCESS_KEY="${MESSAGES_MINIO_ACCESS_KEY:-minioadmin}"
MINIO_SECRET_KEY="${MESSAGES_MINIO_SECRET_KEY:-minioadmin}"
BACKUP_BUCKETS="${BACKUP_BUCKETS:-messages listings documenso}"
USE_DOCKER="${USE_DOCKER:-0}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"

# Répertoire source obligatoire : la sauvegarde à restaurer.
SRC_DIR="${1:-}"
if [ -z "$SRC_DIR" ] || [ ! -d "$SRC_DIR" ]; then
  printf 'usage: %s <backup-dir>\n' "$0" >&2
  exit 2
fi
SRC_DIR="${SRC_DIR%/}"

# Wrapper docker compose épinglé sur le fichier compose choisi.
compose() { docker compose -f "$COMPOSE_FILE" "$@"; }
# Journalisation préfixée sur stderr.
log() { printf '[restore] %s\n' "$*" >&2; }

restore_mongo() {
  local archive="${SRC_DIR}/mongo/${MONGODB_DB}.archive.gz"
  # Restauration idempotente : on saute proprement si l'archive Mongo est absente.
  [ -f "$archive" ] || { log "skip mongo (no ${archive})"; return 0; }
  log "MongoDB ← ${archive}"
  if [ "$USE_DOCKER" = "1" ]; then
    # --drop supprime chaque collection avant de la réimporter ; l'archive gzip arrive sur stdin.
    compose exec -T mongodb \
      mongorestore --uri="$MONGODB_URL" --archive --gzip --drop <"$archive"
  else
    mongorestore --uri="$MONGODB_URL" --archive="$archive" --gzip --drop
  fi
}

restore_neo4j() {
  local dump="${SRC_DIR}/neo4j/${NEO4J_DATABASE}.dump"
  # On saute si le dump Neo4j est absent.
  [ -f "$dump" ] || { log "skip neo4j (no ${dump})"; return 0; }
  log "Neo4j ← ${dump} (offline load)"
  if [ "$USE_DOCKER" = "1" ]; then
    # Chargement hors ligne : le service doit être arrêté le temps du load, puis redémarré.
    compose stop neo4j
    compose run --rm --no-deps \
      -v "$(pwd)/${SRC_DIR}/neo4j:/backups" \
      neo4j \
      neo4j-admin database load "$NEO4J_DATABASE" --from-path=/backups --overwrite-destination=true
    compose start neo4j
  else
    # Mode hôte : Neo4j doit déjà être arrêté.
    neo4j-admin database load "$NEO4J_DATABASE" \
      --from-path="${SRC_DIR}/neo4j" --overwrite-destination=true
  fi
}

restore_minio() {
  # On saute s'il n'y a pas de dossier minio dans la sauvegarde.
  [ -d "${SRC_DIR}/minio" ] || { log "skip minio (no ${SRC_DIR}/minio)"; return 0; }
  log "MinIO buckets: ${BACKUP_BUCKETS}"
  if [ "$USE_DOCKER" = "1" ]; then
    local endpoint="${MINIO_ENDPOINT}"
    # Depuis un conteneur, localhost/127.0.0.1 est réécrit vers le nom de service in-network.
    case "$endpoint" in *localhost* | *127.0.0.1*) endpoint="http://minio:9000" ;; esac
    compose run --rm --no-deps -T \
      -v "$(pwd)/${SRC_DIR}/minio:/backup" \
      --entrypoint sh \
      minio-createbucket -c "
        set -e
        mc alias set dst '${endpoint}' '${MINIO_ACCESS_KEY}' '${MINIO_SECRET_KEY}'
        for b in ${BACKUP_BUCKETS}; do
          [ -d \"/backup/\$b\" ] || continue
          mc mb --ignore-existing \"dst/\$b\"
          mc mirror --overwrite \"/backup/\$b\" \"dst/\$b\"
        done
      "
  else
    mc alias set cnb-restore "$MINIO_ENDPOINT" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY"
    local b
    for b in $BACKUP_BUCKETS; do
      [ -d "${SRC_DIR}/minio/${b}" ] || continue
      mc mb --ignore-existing "cnb-restore/${b}"
      mc mirror --overwrite "${SRC_DIR}/minio/${b}" "cnb-restore/${b}"
    done
  fi
}

log "restoring from ${SRC_DIR} (USE_DOCKER=${USE_DOCKER})"
restore_mongo
restore_neo4j
restore_minio
log "restore complete"
