# Connected NeighBours

A district-scoped neighbourhood service exchange. Residents of a district offer and request
services and pay each other in **points** rather than money. Agreements can be formalised with a
**Documenso** e-signature, and disagreements are handled through a built-in **dispute** flow.

The repo is a Turborepo + npm workspaces monorepo.

## Apps

| App                 | Stack                     | Port   | Notes                                                        |
| ------------------- | ------------------------- | ------ | ------------------------------------------------------------ |
| `apps/api`          | Express + ts-rest         | `3000` | Resource server; verifies JWTs against the auth-service JWKS |
| `apps/auth-service` | Express + ts-rest         | `3001` | Issues RS256 access tokens + opaque refresh tokens; TOTP 2FA |
| `apps/admin-front`  | React + Vite              | `4000` | Admin console                                                |
| `apps/user-front`   | React + Vite + Tailwind 4 | `5000` | Resident-facing app                                          |
| `apps/landing`      | React + Vite + Tailwind   | `6060` | Public landing page                                          |

## Packages

- `@repo/contracts` — shared ts-rest contracts + zod DTOs (single source of truth for request/response shapes)
- `@repo/hooks` — shared React auth (`AuthProvider`, `ProtectedRoute`, `useAuth`, …)
- `@repo/config` — shared frontend runtime config (public URLs)
- `@repo/satan` — SATAN QL client: thin bridge to a Python worker running SQL-like queries against MongoDB
- `@repo/eslint-config` — shared ESLint configs
- `@repo/typescript-config` — shared `tsconfig.json`s

## API docs

The api serves interactive **Scalar** docs at [`/docs`](http://localhost:3000/docs) and the raw OpenAPI
spec at [`/openapi.json`](http://localhost:3000/openapi.json).

## Getting started

Full setup instructions live in [`documentation/getting-started.md`](documentation/getting-started.md).

Quick start — run every app with hot reload:

```bash
npm install
npm run dev
```

Databases and the Documenso e-signature stack run via Docker Compose. There are no profiles — one command brings up the whole stack:

```bash
# app + Mongo / Neo4j / MinIO / fronts + Documenso e-signature (Documenso / Postgres / mailpit)
docker compose up
```

Copy `.env.dist` to `.env` and fill in what differs from the localhost defaults.

## Scripts

- `npm run dev` — launch all apps with live reload
- `npm run build` — build all apps
- `npm run lint` — lint all apps with ESLint
- `npm run format` — format all apps with Prettier
