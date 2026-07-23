# Architecture

This document describes the technical architecture of the monorepo.

---

## Overview

The project is a **Turborepo monorepo** built entirely in TypeScript, following a **contract-first** approach where every API endpoint is defined once as a shared contract consumed by both the backend and frontends.

> 📊 For rendered diagrams (system view, monorepo dependency graph, API layers, auth flow, deployment topology) see [`architecture-schema.md`](./architecture-schema.md).

```
.
├── apps/
│   ├── api/           # Express REST API : port 3000
│   ├── auth-service/  # Express REST API (auth) : port 3001
│   ├── admin-front/   # React 19 + Vite + Tailwind 4 : port 4000
│   ├── user-front/    # React 19 + Vite + Tailwind 4 : port 5000
│   └── landing/       # React 19 + Vite + Tailwind 4 (marketing site) : port 6060
├── packages/
│   ├── contracts/     # ts-rest + Zod contracts (the source of truth)
│   ├── hooks/         # Shared React auth (AuthProvider, ProtectedRoute, useAuth)
│   ├── config/        # Shared frontend runtime config (service URLs)
│   ├── ui/            # Shared React component library
│   ├── satan/         # SATAN — custom MongoDB query language (TypeScript + Python)
│   ├── eslint-config/ # Shared ESLint flat-config rules
│   └── typescript-config/ # Shared tsconfig bases
├── playwright_testbook/   # End-to-end API and Front tests
├── docker-compose.yml           # Dev stack (hot reload, builds from source)
└── docker-compose.deploy.yml    # Prod stack (GHCR images, Caddy TLS)
```

---

## Build System — Turborepo

Turborepo orchestrates all tasks across workspaces. Key properties:

| Task                | Cache | Persistent | Notes                                          |
| ------------------- | ----- | ---------- | ---------------------------------------------- |
| `build`             | yes   | no         | Depends on `^build` (dependencies built first) |
| `dev`               | no    | yes        | Hot-reload for all apps in parallel            |
| `lint` / `lint:fix` | yes   | no         | Per-workspace ESLint                           |
| `start`             | yes   | no         | Runs compiled output                           |
| `format`            | yes   | no         | Prettier over all workspaces                   |

---

## Contracts Package (`@repo/contracts`)

The contracts package is the **architectural core** of the project. It is the single source of truth for:

- API endpoint paths and HTTP methods
- Request schemas (query params, path params, request bodies)
- Response schemas (status codes and body shapes)
- TypeScript DTO types
- OpenAPI documentation

Both the Express router and any frontend client import from `@repo/contracts` — making the API type-safe end-to-end without code generation.

### Technology

- **ts-rest** (`@ts-rest/core`) — defines typed routers; consumed by `@ts-rest/express` on the server and directly by clients
- **Zod** — schema definitions, used for runtime validation and TypeScript type inference

---

## API App (`apps/api`)

The API follows **Clean Architecture** with three concentric layers: routes → use cases → repositories.

### Entry Point (`src/index.ts`)

- Configures Express with JSON body parsing and CORS (origins: `localhost:4000`, `localhost:5000`)
- Registers all ts-rest routers via `createExpressEndpoints`
- Auto-generates and serves the OpenAPI spec; exposes the **Scalar** UI at `GET /docs`
- Registers the global error handler middleware

### Layers

- Layer 1 — Routes (thin controllers)
- Layer 2 — Use Cases (business logic)
- Layer 3 — Repositories (data access)

The api is a **resource server**: it verifies incoming RS256 access tokens against the auth-service's JWKS (`createRemoteJWKSet`) via `requireAuth` / `requireRole(...)` middleware. It persists domain data in **MongoDB** and the neighbourhood graph in **Neo4j**.

---

## Auth Service (`apps/auth-service`)

A dedicated Express + ts-rest service (port **3001**) that owns authentication and issues tokens; the api never sees passwords.

- Issues **RS256 access tokens** (short-lived) signed with `AUTH_PRIVATE_KEY`, and publishes the matching public key at `GET /.well-known/jwks.json` so the api can verify without a shared secret.
- Issues **opaque refresh tokens** (64-byte hex, stored as sha256 in Mongo) in an httpOnly cookie scoped to `/auth`.
- Hashes passwords with **argon2**; supports **TOTP** 2FA and email flows (password reset / verification via Resend).
- Register runs here but creates the user through `POST API_URL/users`, authenticated with a short-lived self-signed `role: "service"` JWT.

See `documentation/auth-service.md` for the full flow.

---

## Frontend Apps

There are three React 19 + Vite 8 frontends, all styled with **Tailwind CSS 4** (via `@tailwindcss/vite`). `admin-front` and `user-front` share the same base structure — contract-typed clients and `@repo/hooks` auth — while `landing` is a standalone marketing site (FlyonUI components, no authenticated surface).

| App           | Port | Stack                                             |
| ------------- | ---- | ------------------------------------------------- |
| `admin-front` | 4000 | React 19, Vite 8, TypeScript, Tailwind 4          |
| `user-front`  | 5000 | React 19, Vite 8, TypeScript, Tailwind 4          |
| `landing`     | 6060 | React 19, Vite 8, TypeScript, Tailwind 4, FlyonUI |

Each app resolves its host port from an env var (`ADMIN_PORT` / `USER_PORT` / `LANDING_PORT`), falling back to the defaults above. `admin-front` and `user-front` consume auth via `@repo/hooks`; service URLs come from `@repo/config`. TypeScript is configured via `@repo/typescript-config/vite.json` (targets ESNext + DOM, source maps enabled). There is no shared UI-component package today — each front keeps its own components (a future `packages/ui` extraction is noted in ROADMAP.md).

---

## Shared Tooling Packages

### `@repo/typescript-config`

Three tsconfig bases:

| File                 | Used by   | Notable settings                                               |
| -------------------- | --------- | -------------------------------------------------------------- |
| `base.json`          | All       | Strict mode, ESNext, `isolatedModules`, declarations           |
| `node.json`          | `api`     | NodeNext module resolution, no implicit returns/override       |
| `vite.json`          | Frontends | ESNext module, DOM lib, `useDefineForClassFields`, source maps |
| `react-library.json` | `ui`      | Extends base, JSX `react-jsx`                                  |

### `@repo/eslint-config`

ESLint 9 flat-config rules, composed per environment:

| Config     | Used by   | Key rules                                                                          |
| ---------- | --------- | ---------------------------------------------------------------------------------- |
| `base.js`  | All       | Consistent type imports, `_`-prefixed unused vars, no console except warn/error    |
| `node.js`  | `api`     | Extends base + no floating promises (error)                                        |
| `react.js` | Frontends | Extends base + hooks rules-of-hooks (error), exhaustive-deps (warn), react-refresh |

---

## Infrastructure & Databases

The stack is orchestrated with Docker Compose. There are no profiles — `docker compose up` starts the whole stack (app services + datastores + fronts + the Documenso e-signature services).

Both compose files define the same topology and differ in intent. `docker-compose.yml` is the **dev** compose (the default a bare `docker compose` picks up): it builds the `dev` Dockerfile target with source bind-mounts for hot reload, uses zero-config local credentials, and pins exact image versions. `docker-compose.deploy.yml` is the **production** compose: it has no `build:` — every app runs from the `ghcr.io/esgi-3al2-pa/web-apps/<app>` image CD built (compiled `dist/` served by a hardened nginx), a Caddy reverse proxy terminates TLS, and all secrets + URLs come from the SOPS-decrypted env at deploy. In dev the apps can also be run directly on the host with `npm run dev`.

### Datastores

| Store             | Image                 | Port(s)                   | Purpose                                                                                                                                                                                                                                        |
| ----------------- | --------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MongoDB**       | `mongo:8`             | 27017                     | Primary document store — users, districts, listings, events, votes, incidents, conversations, messages, notifications, refresh tokens, transactions, contracts (see `documentation/MCD/mongo.md`)                                              |
| **mongo-express** | `mongo-express`       | 8081                      | Web admin UI for MongoDB                                                                                                                                                                                                                       |
| **Neo4j**         | `neo4j:5`             | 7474 (HTTP), 7687 (Bolt)  | Graph of neighbourhood relationships — `User`, `District`, `Event` nodes with `LIVES_IN`, `KNOWS`, `CREATED`, `REGISTERED_FOR`, `ATTENDED`, `CONTAINS` edges (see `documentation/MCD/neo4j.md`); backs recommendations and district boundaries |
| **Postgres**      | `postgres:15`         | 5432                      | Backing database for Documenso (e-signature)                                                                                                                                                                                                   |
| **Documenso**     | `documenso/documenso` | 3030 (web/API)            | Self-hosted e-signature service for contracts (see `documentation/documenso-integration.md`)                                                                                                                                                   |
| **MinIO**         | `minio/minio`         | 9000 (S3), 9001 (console) | S3-compatible object storage for Documenso document files                                                                                                                                                                                      |
| **mailpit**       | `axllent/mailpit`     | 8025 (UI), 1025 (SMTP)    | Local SMTP catch-all for inspecting outgoing mail in dev                                                                                                                                                                                       |

### Data ownership

- The **api** reads and writes MongoDB (domain data) and Neo4j (the social/district graph).
- The **auth-service** stores credentials and refresh tokens in MongoDB.
- **Documenso** is an external integration the api calls over HTTP (`DOCUMENSO_URL`); it owns its own Postgres + MinIO and starts alongside the rest of the stack.
