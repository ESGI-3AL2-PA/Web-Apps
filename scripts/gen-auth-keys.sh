#!/usr/bin/env bash
# Generate a stable RS256 keypair for the local auth-service so restarts don't
# rotate keys (which would invalidate the api's JWKS cache and every session).
# Output is git-ignored; the dev compose mounts it read-only.
#
# Usage: ./scripts/gen-auth-keys.sh
#
# Uses a throwaway alpine/openssl container so no local openssl install is required.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
out_dir="${repo_root}/docker/auth"
mkdir -p "${out_dir}"

if [[ -f "${out_dir}/private.pem" && -f "${out_dir}/public.pem" ]]; then
  echo "auth keys already exist at docker/auth/ — delete them first to regenerate."
  exit 0
fi

docker run --rm -v "${out_dir}:/work" --entrypoint sh alpine/openssl -c '
  openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out /work/private.pem &&
  openssl pkey -in /work/private.pem -pubout -out /work/public.pem &&
  chmod 644 /work/private.pem /work/public.pem
'

echo "generated docker/auth/{private,public}.pem"
