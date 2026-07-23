#!/usr/bin/env sh
# Génère la paire de clés RS256 avec laquelle l'auth-service signe les access tokens. Le compose
# prod monte ./docker/auth dans le conteneur en lecture seule (AUTH_PRIVATE_KEY_FILE / _PUBLIC_KEY_FILE).
# À lancer une fois sur l'hôte de déploiement (ou localement pour un run prod-like). Les clés sont
# gitignorées — elles ne doivent jamais être commitées. Les faire tourner invalide tout token émis,
# il faut donc les garder stables.
#
# Usage : scripts/gen-auth-keys.sh [répertoire-de-sortie]   (défaut : docker/auth)
set -eu

DIR="${1:-docker/auth}"
mkdir -p "$DIR"

# Refus idempotent : on ne réécrit jamais des clés existantes (supprimer d'abord pour rotation).
if [ -f "$DIR/private.pem" ] || [ -f "$DIR/public.pem" ]; then
  echo "Keys already exist in $DIR — refusing to overwrite (delete them first to rotate)." >&2
  exit 0
fi

# Clé privée RSA 2048 bits, puis extraction de la clé publique correspondante.
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$DIR/private.pem"
openssl rsa -in "$DIR/private.pem" -pubout -out "$DIR/public.pem"
# Clé privée en 600 (lecture propriétaire seule), clé publique en 644.
chmod 600 "$DIR/private.pem"
chmod 644 "$DIR/public.pem"

echo "Wrote $DIR/private.pem (600) and $DIR/public.pem (644)."
