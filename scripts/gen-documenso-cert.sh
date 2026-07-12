#!/usr/bin/env bash
# Generate a self-signed P12 signing certificate for the local Documenso container.
# Documenso refuses to sign documents without one. Output is git-ignored.
#
# Usage: ./scripts/gen-documenso-cert.sh
#
# Uses a throwaway alpine/openssl container so no local openssl install is required.
# The -legacy flag keeps the PKCS#12 readable by Documenso's node-forge signer.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
out_dir="${repo_root}/docker/documenso"
mkdir -p "${out_dir}"

if [[ -f "${out_dir}/cert.p12" ]]; then
  echo "cert already exists at docker/documenso/cert.p12 — delete it first to regenerate."
  exit 0
fi

docker run --rm -v "${out_dir}:/work" --entrypoint sh alpine/openssl -c '
  cd /work &&
  openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 3650 -nodes \
    -subj "/CN=Documenso Dev/O=Local" &&
  openssl pkcs12 -export -legacy -out cert.p12 -inkey key.pem -in cert.pem -passout pass: &&
  rm -f key.pem cert.pem &&
  chmod 644 cert.p12
'

echo "generated docker/documenso/cert.p12"
