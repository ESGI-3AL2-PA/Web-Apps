#!/usr/bin/env bash
# One-time fresh-VPS bootstrap (run as root on Debian/Ubuntu).
# Idempotent-ish: safe to re-run, but review before doing so.
# After this, finish the manual steps printed at the end. See
# documentation/deployment.md for the full walkthrough.
set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-deploy}"
APP_DIR="${APP_DIR:-/opt/web-apps}"
REPO_URL="${REPO_URL:-https://github.com/ESGI-3AL2-PA/Web-Apps.git}"

echo "▸ Installing Docker Engine + compose plugin…"
curl -fsSL https://get.docker.com | sh

echo "▸ Installing sops + age…"
apt-get update -y
apt-get install -y age git
SOPS_VER="v3.9.4"
curl -fsSL "https://github.com/getsops/sops/releases/download/${SOPS_VER}/sops-${SOPS_VER}.linux.amd64" \
  -o /usr/local/bin/sops
chmod +x /usr/local/bin/sops

echo "▸ Creating deploy user '${DEPLOY_USER}'…"
if ! id "$DEPLOY_USER" &>/dev/null; then
  adduser --disabled-password --gecos "" "$DEPLOY_USER"
fi
usermod -aG docker "$DEPLOY_USER"

echo "▸ Firewall (ufw): allow SSH + HTTP + HTTPS…"
if command -v ufw &>/dev/null; then
  ufw allow OpenSSH
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw --force enable
fi

echo "▸ Cloning repo into ${APP_DIR}…"
mkdir -p "$APP_DIR"
chown "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR"
if [ ! -d "$APP_DIR/.git" ]; then
  sudo -u "$DEPLOY_USER" git clone "$REPO_URL" "$APP_DIR"
fi

echo "▸ Installing nightly backup cron (04:00) for '${DEPLOY_USER}'…"
CRON_LINE="0 4 * * * cd ${APP_DIR} && ./scripts/backup.sh >> ${APP_DIR}/backups/backup.log 2>&1"
if ! sudo -u "$DEPLOY_USER" crontab -l 2>/dev/null | grep -qF "scripts/backup.sh"; then
  ( sudo -u "$DEPLOY_USER" crontab -l 2>/dev/null; echo "$CRON_LINE" ) | sudo -u "$DEPLOY_USER" crontab -
fi

cat <<EOF

✓ Base provisioning done. Now, AS the '${DEPLOY_USER}' user, finish setup:

  1. Generate the SOPS age key:
       mkdir -p ~/.config/sops/age
       age-keygen -o ~/.config/sops/age/keys.txt
     Copy the printed "public key: age1..." into .sops.yaml (age:) and commit.

  2. Create + encrypt the production secrets:
       cd ${APP_DIR}
       cp secrets/prod.env.example secrets/prod.env
       \$EDITOR secrets/prod.env          # fill domains, DB pw, RS256 keypair, Resend…
       sops -e secrets/prod.env > secrets/prod.enc.env
       git add secrets/prod.enc.env && git commit && git push

  3. Add a CI deploy SSH key:
       ssh-keygen -t ed25519 -f ~/.ssh/ci_deploy -N ""
       cat ~/.ssh/ci_deploy.pub >> ~/.ssh/authorized_keys
     Put the PRIVATE key (~/.ssh/ci_deploy) in GitHub secret DEPLOY_SSH_KEY.

  4. Log in to GHCR so 'docker compose pull' can read the images:
       docker login ghcr.io -u <github-user> -p <read:packages PAT>
     (or make the GHCR packages public and skip this).

  5. Point DNS A-records at this server:
       app / admin / api / auth  ->  <this VPS IP>

  6. Set GitHub repo Variables: DEPLOY_HOST, DEPLOY_USER (=${DEPLOY_USER}),
     VITE_API_URL (=https://api.<domain>), VITE_AUTH_SERVICE_URL (=https://auth.<domain>).

  7. First deploy:  cd ${APP_DIR} && ./scripts/deploy.sh
EOF
