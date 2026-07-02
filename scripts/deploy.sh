#!/usr/bin/env bash
# Runs on the VPS (invoked by the deploy job over SSH, or manually).
# Pulls the latest repo + images and rolls the prod stack forward.
#
#   TAG=<git-sha> ./scripts/deploy.sh      # TAG defaults to "latest"
set -euo pipefail

cd "$(dirname "$0")/.."

export TAG="${TAG:-latest}"
export SOPS_AGE_KEY_FILE="${SOPS_AGE_KEY_FILE:-$HOME/.config/sops/age/keys.txt}"
COMPOSE="docker compose -f docker-compose.prod.yml"

echo "▸ Fetching repo (compose, Caddyfile, encrypted secrets)…"
git fetch --quiet origin main
git reset --hard --quiet origin/main

echo "▸ Decrypting secrets with SOPS…"
sops -d secrets/prod.enc.env > secrets/prod.env
chmod 600 secrets/prod.env

echo "▸ Pulling images (TAG=$TAG)…"
$COMPOSE pull

echo "▸ Starting stack…"
$COMPOSE up -d --remove-orphans

echo "▸ Pruning old images…"
docker image prune -f

echo "✓ Deploy complete."
$COMPOSE ps
