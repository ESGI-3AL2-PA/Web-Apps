# TODO — env vars before deploy

Dev defaults are fine for `npm run dev` / `docker compose up`. Set these before any non-local environment.

## auth-service (`apps/auth-service`)

| Var                | Required            | Default                                | Notes                                                                                 |
| ------------------ | ------------------- | -------------------------------------- | ------------------------------------------------------------------------------------- |
| `PORT`             | no                  | `3001`                                 | Listen port.                                                                          |
| `MONGODB_URL`      | yes (non-local)     | `mongodb://root:root@localhost:27017`  | Shared with the api.                                                                  |
| `MONGODB_DB`       | yes (non-local)     | `db`                                   |                                                                                       |
| `API_URL`          | yes (in docker)     | `http://localhost:3000`                | Where register POSTs the new user. In docker compose set to `http://api:3000`.        |
| `AUTH_PRIVATE_KEY` | **yes (prod)**      | ephemeral generated at boot            | RS256 PEM. Without these, every restart invalidates outstanding tokens.               |
| `AUTH_PUBLIC_KEY`  | **yes (prod)**      | ephemeral generated at boot            | Must match the private key.                                                           |
| `AUTH_PUBLIC_URL`  | **yes (prod)**      | `http://localhost:3001`                | Public URL the auth-service serves on. Used to build verification + reset links.      |
| `CORS_ORIGINS`     | **yes (non-local)** | `http://localhost:3000,4000,5000`      | Comma-separated. Also serves as the `redirect_uri` allowlist on login/register pages. |
| `RESEND_API_KEY`   | **yes (prod)**      | _(none — falls back to `console.log`)_ | Without it, verification and reset emails are only printed to stdout.                 |
| `FROM_EMAIL`       | **yes (prod)**      | `no-reply@example.com`                 | Must be on a domain you've verified in Resend.                                        |
| `APP_NAME`         | no                  | `Web-Apps`                             | Used in email subject/body.                                                           |
| `TOTP_ISSUER`      | no                  | `Web-Apps`                             | What users see as the account name in their authenticator app.                        |
| `NODE_ENV`         | yes (prod)          | _(none)_                               | Setting to `production` flips refresh + csrf cookies to `secure: true`.               |

## api (`apps/api`)

| Var             | Required            | Default                                       | Notes                                                                             |
| --------------- | ------------------- | --------------------------------------------- | --------------------------------------------------------------------------------- |
| `MONGODB_URL`   | yes (non-local)     | `mongodb://root:root@localhost:27017`         |                                                                                   |
| `MONGODB_DB`    | yes (non-local)     | `db`                                          |                                                                                   |
| `AUTH_JWKS_URL` | **yes (non-local)** | `http://localhost:3001/.well-known/jwks.json` | Must point at the auth-service's JWKS. In docker: `http://auth-service:3001/...`. |
| `CORS_ORIGINS`  | **yes (non-local)** | `http://localhost:4000,5000`                  | Comma-separated frontend origins.                                                 |

## user-front (`apps/user-front`)

Vite env vars — must be prefixed `VITE_` to be exposed to the browser.

| Var                     | Required        | Default                 | Notes                       |
| ----------------------- | --------------- | ----------------------- | --------------------------- |
| `VITE_AUTH_SERVICE_URL` | yes (non-local) | `http://localhost:3001` | Public URL of auth-service. |
| `VITE_API_URL`          | yes (non-local) | `http://localhost:3000` | Public URL of api.          |

## admin-front (`apps/admin-front`)

| Var                     | Required        | Default                 | Notes |
| ----------------------- | --------------- | ----------------------- | ----- |
| `VITE_AUTH_SERVICE_URL` | yes (non-local) | `http://localhost:3001` |       |

## Generating RS256 keys for prod

```sh
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out auth-private.pem
openssl rsa -in auth-private.pem -pubout -out auth-public.pem
# Then pipe the PEMs into your secret store; set AUTH_PRIVATE_KEY / AUTH_PUBLIC_KEY to the full PEM string (newlines and all).
```

## Security hardening (backlog)

### H5 — Per-account MFA brute-force limiting

`POST /auth/login/mfa` is only rate-limited per IP (5/min, `apps/auth-service/src/index.ts`). A 6-digit
TOTP is 1M combinations and the `mfa_token` lives 5 min, so an attacker rotating IPs has no per-account
ceiling, and failed attempts never invalidate the `mfa_token` or secret. Replay is already handled (H4:
`lastTotpStep` / `consumeTotpStep`), but throttling is not.

Approach is still undecided — Mongo-backed per-user counter was rejected. Candidates:

- `express-rate-limit` keyed on the `mfa_token`'s `sub` instead of IP (no new infra, resets on restart,
  not multi-instance-safe without a shared store).
- Invalidate the `mfa_token` after N failures (track attempts against the short-lived token itself).
- Shared store (Redis) keyed by user — durable + multi-instance, but adds infra not currently run.

Also consider requiring a current TOTP code (not just password) to `disable-totp`.

## One-shot data migration

Existing user docs predate `emailVerified` / `totpSecret` / `totpEnabled`. Without this, every existing account will be locked out on next login.

```js
db.users.updateMany(
  { emailVerified: { $exists: false } },
  { $set: { emailVerified: true, totpSecret: null, totpEnabled: false } },
);
```
