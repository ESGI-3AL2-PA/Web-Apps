# Deployment (VPS + CI/CD)

Production runs as pre-built Docker images pulled from **GHCR**, orchestrated by
`docker-compose.prod.yml`, behind **Caddy** (automatic Let's Encrypt TLS).
Secrets are encrypted in-repo with **SOPS/age** and decrypted on the VPS at deploy.

```
GitHub push to main
  └─ .github/workflows/deploy.yml
       ├─ ci          npm ci → lint → build            (also on PRs)
       ├─ build-push  build 4 images → push ghcr.io/…   (main only)
       └─ deploy      ssh VPS → scripts/deploy.sh       (main only)
                          └─ git pull → sops -d → compose pull → up -d
```

## Pieces

| File                                  | Role                                                                                     |
| ------------------------------------- | ---------------------------------------------------------------------------------------- |
| `apps/*/Dockerfile` (`prod` target)   | backends → `node dist`; fronts → build (VITE\_\* baked via build-args) then nginx static |
| `docker-compose.prod.yml`             | prod stack: GHCR images, Caddy, mongo/neo4j volumes; only Caddy publishes 80/443         |
| `Caddyfile`                           | routes `app/admin/api/auth` subdomains, auto-TLS                                         |
| `.sops.yaml` + `secrets/prod.enc.env` | encrypted env (committed); `secrets/prod.env` decrypted at deploy (gitignored)           |
| `scripts/provision.sh`                | one-time fresh-VPS bootstrap                                                             |
| `scripts/deploy.sh`                   | idempotent rollout, run on the VPS                                                       |
| `.github/workflows/deploy.yml`        | CI + CD                                                                                  |

## Key facts / gotchas

- **Frontend env is build-time.** `VITE_API_URL` / `VITE_AUTH_SERVICE_URL` are inlined by Vite
  during the image build, sourced from GitHub repo **Variables** and passed as `--build-arg`.
  Changing them requires a rebuild, not just a restart.
- **Auth RS256 keys must be stable.** `AUTH_PRIVATE_KEY` / `AUTH_PUBLIC_KEY` live (encrypted) in
  `secrets/prod.enc.env`. Store the PEM as a single line with `\n` escapes — `keys.ts` normalizes them.
  Ephemeral keys are refused when `NODE_ENV=production`.
- **One env_file, one source of truth.** All services read `secrets/prod.env`; keep `MONGODB_URL`'s
  password in sync with `MONGO_INITDB_ROOT_PASSWORD` there.
- Images are **private** by default → the VPS needs `docker login ghcr.io` with a read:packages PAT
  (or make the packages public).

## First-time setup

1. **Provision the VPS** (as root): `curl … | bash` the repo's `scripts/provision.sh`, or run it after
   cloning. It installs Docker + sops + age, creates the `deploy` user, opens the firewall (22/80/443),
   and clones the repo to `/opt/web-apps`. Then follow the printed manual steps:
   - `age-keygen` → put the **public** key in `.sops.yaml`, keep the private key at
     `~/.config/sops/age/keys.txt`.
   - `cp secrets/prod.env.example secrets/prod.env`, fill it in, `sops -e … > secrets/prod.enc.env`,
     commit `prod.enc.env`.
   - Add a CI SSH key: public → `deploy`'s `authorized_keys`, private → GitHub secret `DEPLOY_SSH_KEY`.
   - `docker login ghcr.io` (read PAT) unless packages are public.
   - Point DNS A-records (`app`/`admin`/`api`/`auth`) at the VPS.
2. **Configure GitHub**:
   - Secrets: `DEPLOY_SSH_KEY`
   - Variables: `DEPLOY_HOST`, `DEPLOY_USER` (=`deploy`), `VITE_API_URL` (=`https://api.<domain>`),
     `VITE_AUTH_SERVICE_URL` (=`https://auth.<domain>`)
3. **First deploy**: push to `main` (CI/CD runs) or, on the VPS, `cd /opt/web-apps && ./scripts/deploy.sh`.

## Day-2

- **Deploy**: merge to `main` → pipeline redeploys. Manual: `TAG=<sha> ./scripts/deploy.sh` on the VPS.
- **Rollback**: `TAG=<older-sha> ./scripts/deploy.sh` (images are tagged per commit).
- **Rotate a secret**: edit with `sops secrets/prod.enc.env`, commit, redeploy.
- **Logs**: `docker compose -f docker-compose.prod.yml logs -f <service>`.
- **Backups**: `scripts/backup.sh` runs nightly at 04:00 via cron (installed by `provision.sh`),
  writing to `./backups` with a 7-day retention (`RETENTION_DAYS` overridable). Mongo is dumped
  online; **Neo4j is briefly stopped** (~seconds) since Community has no online backup. Run manually
  anytime with `./scripts/backup.sh`. Copy `./backups` off-box periodically — it's not itself replicated.

### Restore

```bash
COMPOSE="docker compose -f docker-compose.prod.yml"

# Mongo (drops + restores from an archive)
$COMPOSE exec -T mongodb sh -c \
  'mongorestore --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" \
   --authenticationDatabase admin --archive --gzip --drop' < backups/mongo/mongo-<STAMP>.archive.gz

# Neo4j (server must be stopped to load a dump)
$COMPOSE stop neo4j
$COMPOSE run --rm --no-deps -v "$PWD/backups/neo4j/<STAMP>:/backup" neo4j \
  neo4j-admin database load neo4j --from-path=/backup --overwrite-destination=true
$COMPOSE start neo4j
```
