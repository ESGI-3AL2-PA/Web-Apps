# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

Turborepo + npm workspaces. Run `npm run dev` to launch every app with hot reload, or bring the stack up with Docker Compose. The composes use **profiles**: `--profile core` starts the app + Mongo / Neo4j / fronts, and `--profile contracts` adds the Documenso e-signature stack (Documenso / Postgres / MinIO / mailpit). A bare `docker compose up` (no profile) starts nothing.

```bash
docker compose -f docker-compose.local.yml --profile core up              # app only
docker compose -f docker-compose.local.yml --profile core --profile contracts up   # + e-signature
```

- `apps/api` — Express + ts-rest, port **3000**, resource server (verifies JWTs against the auth-service's JWKS)
- `apps/auth-service` — Express + ts-rest, port **3001**, issues RS256 access tokens + opaque refresh tokens (argon2 password hashing, refresh cookie scoped to `/auth`)
- `apps/admin-front` — React + Vite, port **4000**
- `apps/user-front` — React + Vite + Tailwind 4, port **5000**
- `apps/landing` — React + Vite + Tailwind 4, port **6060** (public marketing page; deep-links into auth via `@repo/config`)
- `packages/contracts` (`@repo/contracts`) — shared ts-rest contracts + zod DTOs (single source of truth for request/response shapes)
- `packages/hooks` (`@repo/hooks`) — shared React auth (`AuthProvider`, `ProtectedRoute`, `useAuth`, `isTokenExpiringSoon`)
- `packages/config` (`@repo/config`) — centralized frontend runtime config; reads service URLs from Vite env once so apps never re-derive them
- `packages/satan` (`@repo/satan`) — SATAN QL bridge: a thin subprocess wrapper over a Python (PLY + pymongo) worker that runs SQL-like queries against Mongo. The api wraps its Mongo repos in SATAN-QL counterparts unless `SATAN_REPOS=false`
- `packages/eslint-config`, `packages/typescript-config` — shared configs

## Adding an endpoint (api or auth-service)

Always follow the layered pattern — contracts first, then work inward:

1. Add the DTO (zod schema) to `packages/contracts/src/DTO/` and re-export from `DTO/index.ts`
2. Add the route to the relevant contract in `packages/contracts/src/*.contract.ts`
3. If a new collection is involved, define the entity in `apps/<app>/src/entities/`
4. Add a repository interface + Mongo implementation under `apps/<app>/src/repositories/<Domain>/`, then register it in `repositories/container.ts`
5. Write the use-case in `apps/<app>/src/use-cases/` — it takes repositories as args, returns plain data
6. Wire the route handler in `apps/<app>/src/routes/.../<domain>.router.ts` — handler resolves deps via `resolve("name")` and calls the use-case

Protected api routes go through `requireAuth` (and `requireRole(...)` when role gating is needed) from `apps/api/src/middleware/auth.middleware.ts`.

## Auth flow specifics

- The api verifies access tokens via `createRemoteJWKSet(AUTH_JWKS_URL)`. Default points at `http://localhost:3001/.well-known/jwks.json`; docker uses `http://auth-service:3001/...`.
- Register flow runs **inside auth-service** but creates the user via `POST API_URL/users` using a short-lived (`30s`) `role: "service"` JWT it signs itself. `API_URL` defaults to `http://localhost:3000`; docker sets `http://api:3000`.
- Refresh tokens are 64-byte hex stored as sha256 in Mongo, returned in an httpOnly cookie at path `/auth`.

## Environment

Backends use `process.env.*` with localhost defaults (see `.env.dist` for the full template):

- api: `MONGODB_URL`, `MONGODB_DB`, `AUTH_JWKS_URL`, `CORS_ORIGINS` (default fronts only), `NODE_ENV`
- auth-service: `MONGODB_URL`, `MONGODB_DB`, `API_URL`, `PORT` (default `3001`), `AUTH_PUBLIC_URL` (base for email links), `CORS_ORIGINS` (default also allows api origin), `AUTH_PRIVATE_KEY` / `AUTH_PUBLIC_KEY` (RS256 PEM; ephemeral keys generated if missing), `TOTP_ISSUER`, `RESEND_API_KEY` (email; mail is no-op if unset), `FROM_EMAIL`, `APP_NAME`, `NODE_ENV`

Frontends use `import.meta.env.VITE_*` with localhost defaults:

- `VITE_AUTH_SERVICE_URL` (default `http://localhost:3001`)
- `VITE_API_URL` (default `http://localhost:3000`, user-front only)

## Code style

Prettier config lives at the repo root. The non-default settings that matter:

- 120-char line width, **double** quotes, semicolons, trailing commas everywhere, LF endings, arrow parens always

ESLint (`@repo/eslint-config`) enforces:

- `@typescript-eslint/consistent-type-imports` — use `import type` for type-only imports
- Unused vars must be prefixed with `_` to be ignored
- Only `console.warn` and `console.error` are allowed
- Non-null assertions (`!`) are allowed

Format with `npm run format`, lint with `npm run lint` (or `lint:fix`).

## Git / PRs

Feature branches: `feat/*` for features, `fix/*` for fixes. PRs target `main` and go through review — don't push directly to `main`.

## Notes

- There is no test suite yet. Don't claim a change is verified without running it end-to-end (e.g., curl the api, hit the front).
- `packages/types` exists as a workspace dir but has no `package.json` — ignore it unless asked.
- Both backends use `"type": "module"`; tsx for dev, `tsc` for build. Build output lands in `apps/<app>/dist`.
