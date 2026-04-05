# Architecture

This document describes the technical architecture of the monorepo.

---

## Overview

The project is a **Turborepo monorepo** built entirely in TypeScript, following a **contract-first** approach where every API endpoint is defined once as a shared contract consumed by both the backend and frontends.

```
.
├── apps/
│   ├── api/           # Express REST API : port 3000
│   ├── admin-front/   # React 19 + Vite : port 4000
│   ├── user-front/    # React 19 + Vite : port 5000
│   └── auth-service/  # Express REST API : port 6000
├── packages/
│   ├── contracts/     # ts-rest + Zod contracts (the source of truth)
│   ├── ui/            # Shared React component library
│   ├── SATAN          # Custom query language for MongoDB, written in typescript and python
│   ├── eslint-config/ # Shared ESLint flat-config rules
│   └── typescript-config/ # Shared tsconfig bases
├── playwright_testbook/   # End-to-end API and Front tests
├── docker-compose.yml           # Full stack for dev env
├── docker-compose.local.yml     # Databases only
└── docker-compose.prod.yml      # Full stack for production env
```

---

## Build System — Turborepo

Turborepo orchestrates all tasks across workspaces. Key properties:

| Task | Cache | Persistent | Notes |
|---|---|---|---|
| `build` | yes | no | Depends on `^build` (dependencies built first) |
| `dev` | no | yes | Hot-reload for all apps in parallel |
| `lint` / `lint:fix` | yes | no | Per-workspace ESLint |
| `start` | yes | no | Runs compiled output |
| `format` | yes | no | Prettier over all workspaces |

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
- 
---

## Frontend Apps

Both frontend apps are structurally identical.

| App | Port | Stack |
|---|---|---|
| `admin-front` | 4000 | React 19, Vite 8, TypeScript |
| `user-front` | 5000 | React 19, Vite 8, TypeScript |

Each app currently renders shared components from `@repo/ui`. TypeScript is configured via `@repo/typescript-config/vite.json` (targets ESNext + DOM, source maps enabled).

---

## UI Package (`@repo/ui`)

Shared React component library consumed by both frontends.

---

## Shared Tooling Packages

### `@repo/typescript-config`

Three tsconfig bases:

| File | Used by | Notable settings |
|---|---|---|
| `base.json` | All | Strict mode, ESNext, `isolatedModules`, declarations |
| `node.json` | `api` | NodeNext module resolution, no implicit returns/override |
| `vite.json` | Frontends | ESNext module, DOM lib, `useDefineForClassFields`, source maps |
| `react-library.json` | `ui` | Extends base, JSX `react-jsx` |

### `@repo/eslint-config`

ESLint 9 flat-config rules, composed per environment:

| Config | Used by | Key rules |
|---|---|---|
| `base.js` | All | Consistent type imports, `_`-prefixed unused vars, no console except warn/error |
| `node.js` | `api` | Extends base + no floating promises (error) |
| `react.js` | Frontends | Extends base + hooks rules-of-hooks (error), exhaustive-deps (warn), react-refresh |

---

## Infrastructure & Databases
