#!/usr/bin/env sh
# Generate the RS256 keypair the auth-service signs access tokens with. The prod compose
# mounts ./docker/auth into the container read-only (AUTH_PRIVATE_KEY_FILE / _PUBLIC_KEY_FILE).
# Run once on the deploy host (or locally for a prod-like run). Keys are gitignored — they
# must never be committed. Rotating them invalidates every issued token, so keep them stable.
#
# Usage: scripts/gen-auth-keys.sh [output-dir]   (default: docker/auth)
set -eu

DIR="${1:-docker/auth}"
mkdir -p "$DIR"

if [ -f "$DIR/private.pem" ] || [ -f "$DIR/public.pem" ]; then
  echo "Keys already exist in $DIR — refusing to overwrite (delete them first to rotate)." >&2
  exit 0
fi

openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$DIR/private.pem"
openssl rsa -in "$DIR/private.pem" -pubout -out "$DIR/public.pem"
chmod 600 "$DIR/private.pem"
chmod 644 "$DIR/public.pem"

echo "Wrote $DIR/private.pem (600) and $DIR/public.pem (644)."
