#!/usr/bin/env bash
#
# backup.sh — sauvegarde à un instant T de chaque magasin de données Connected NeighBours :
#
#   • MongoDB  (base applicative)                        → archive gzip mongodump
#   • Neo4j    (projection graphe / recommandations)     → dump neo4j-admin database
#   • MinIO/S3 (messages vocaux, images d'annonces,      → mc mirror (par bucket)
#               PDF Documenso)
#
# Tout atterrit sous un unique répertoire horodaté :
#
#   $BACKUP_DIR/<horodatage-UTC>/
#     ├── mongo/<db>.archive.gz
#     ├── neo4j/<database>.dump
#     └── minio/<bucket>/...
#
# Les paramètres de connexion réutilisent les noms de variables de .env.dist ; sourcer
# votre env suffit donc comme configuration :
#
#   set -a; . ./.env; set +a
#   ./scripts/backup.sh
#
# Modes d'exécution (USE_DOCKER) :
#   USE_DOCKER=0  (défaut) — les outils tournent sur l'hôte ; `mongodump`, `neo4j-admin`
#                            et `mc` doivent être dans le PATH.
#   USE_DOCKER=1           — les outils tournent contre la stack compose (aucun outillage
#                            hôte requis). Mongo est dumpé via `docker compose exec` ; Neo4j
#                            et MinIO via des conteneurs `docker compose run` jetables qui
#                            réutilisent les images/volumes/réseau des services.
#
# NOTE : un dump Neo4j Community est une opération *hors ligne* — le store doit être
# arrêté. En mode docker, ce script arrête le service `neo4j`, dumpe, puis le
# redémarre. Sur l'hôte, arrêtez votre instance Neo4j avant de lancer.
#
set -euo pipefail

# ── Config (pilotée par l'env, noms de .env.dist réutilisés) ─────────────────
MONGODB_URL="${MONGODB_URL:-mongodb://root:root@localhost:27017}"
MONGODB_DB="${MONGODB_DB:-db}"

NEO4J_DATABASE="${NEO4J_DATABASE:-neo4j}"   # nom de DB par défaut en édition Community
# NEO4J_USER / NEO4J_PASSWORD ne sont pas nécessaires pour un dump hors ligne mais sont
# honorés par restore.sh et toute étape de vérification en ligne.

# Object store — les deux buckets applicatifs vivent dans la même instance MinIO ; on réutilise
# les identifiants MESSAGES_MINIO_* comme identifiants canoniques.
MINIO_ENDPOINT="${MESSAGES_MINIO_ENDPOINT:-http://localhost:9000}"
MINIO_ACCESS_KEY="${MESSAGES_MINIO_ACCESS_KEY:-minioadmin}"
MINIO_SECRET_KEY="${MESSAGES_MINIO_SECRET_KEY:-minioadmin}"
# Buckets à sauvegarder (séparés par des espaces). Les défauts correspondent au job d'init compose.
BACKUP_BUCKETS="${BACKUP_BUCKETS:-messages listings documenso}"

BACKUP_DIR="${BACKUP_DIR:-./backups}"
USE_DOCKER="${USE_DOCKER:-0}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"

# Horodatage UTC servant de nom de répertoire de sortie unique.
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="${BACKUP_DIR%/}/${TIMESTAMP}"

# Affiche l'en-tête du script (lignes 2 à 40) en guise d'aide.
usage() {
  sed -n '2,40p' "$0"
  exit "${1:-0}"
}
case "${1:-}" in -h | --help | help) usage 0 ;; esac

# Wrapper docker compose épinglé sur le fichier compose choisi.
compose() { docker compose -f "$COMPOSE_FILE" "$@"; }

# Journalisation préfixée, envoyée sur stderr pour ne pas polluer les archives sur stdout.
log() { printf '[backup] %s\n' "$*" >&2; }

# ── Mongo ────────────────────────────────────────────────────────────────────
backup_mongo() {
  local dest="${OUT_DIR}/mongo/${MONGODB_DB}.archive.gz"
  mkdir -p "${OUT_DIR}/mongo"
  log "MongoDB → ${dest}"
  if [ "$USE_DOCKER" = "1" ]; then
    # mongodump streame l'archive sur stdout ; -T désactive le TTY pour garder le pipe propre.
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
    # Conteneur jetable sur l'image neo4j ; il hérite du volume neo4j_data défini par
    # le service, et on bind-monte le répertoire de sortie hôte sur /backups.
    compose run --rm --no-deps \
      -v "$(pwd)/${OUT_DIR}/neo4j:/backups" \
      neo4j \
      neo4j-admin database dump "$NEO4J_DATABASE" --to-path=/backups --overwrite-destination=true
    log "restarting neo4j service"
    compose start neo4j
  else
    # Mode hôte : Neo4j doit déjà être arrêté.
    neo4j-admin database dump "$NEO4J_DATABASE" \
      --to-path="${OUT_DIR}/neo4j" --overwrite-destination=true
  fi
}

# ── MinIO / S3 buckets ───────────────────────────────────────────────────────
backup_minio() {
  mkdir -p "${OUT_DIR}/minio"
  log "MinIO buckets: ${BACKUP_BUCKETS}"
  if [ "$USE_DOCKER" = "1" ]; then
    # Lance l'image du client mc sur le réseau compose ; `minio` s'y résout en interne.
    local endpoint="${MINIO_ENDPOINT}"
    # Un endpoint localhost/127.0.0.1 ne serait pas joignable depuis le conteneur : on le
    # réécrit vers le nom de service in-network.
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
