# Getting Started

This guide covers everything you need to set up a local development environment for this project.

## Prerequisites

| Tool    | Version | Notes                                                          |
| ------- | ------- | -------------------------------------------------------------- |
| Node.js | Latest  | Not enforced (no `engines` field); `nvm use latest` is assumed |
| npm     | 11+     | —                                                              |
| Docker  | Latest  | Required for databases and the containerized services          |
| Git     | Any     | —                                                              |

## 1. Clone the repository

```bash
git clone <repo-url>
cd Web-Apps
```

## 2. Install dependencies

Always prefix Node/npm commands with `nvm install latest && nvm use latest` to ensure the correct Node version is active.

```bash
nvm install latest && nvm use latest
npm install
```

This installs dependencies for all apps and packages in the monorepo (Turborepo workspaces).

## 3. Start the stack

The dev compose (`docker-compose.yml`, the default) uses **profiles**, so a bare `docker compose up` (no profile) starts **zero** containers. Pick a profile:

- `--profile core` — the app + databases + fronts (MongoDB, Neo4j, api, auth-service, admin/user fronts)
- `--profile contracts` — adds the Documenso e-signature stack (Documenso, Postgres, MinIO, mailpit)

Combine them (`--profile core --profile contracts`) to bring up everything.

### Option A — Local dev (recommended)

`npm run dev` brings up the `core` compose stack and then runs Turborepo in watch mode. It is equivalent to:

```bash
docker compose --profile core up -d
nvm install latest && nvm use latest
npm run dev
```

The dev compose (`docker-compose.yml`) services bind-mount the repo for hot reload. Add `--profile contracts` to the compose command if you need the e-signature stack.

### Option B — Full stack in Docker

Run everything from the root compose file inside Docker:

```bash
docker compose --profile core up
```

> The containers bind-mount the repo root and watch for changes, so live reload still works. Add `--profile contracts` for the Documenso e-signature stack.

## 4. Verify everything is running

| Service           | URL                            |
| ----------------- | ------------------------------ |
| API               | `http://localhost:3000`        |
| API Health check  | `http://localhost:3000/health` |
| API Docs (Scalar) | `http://localhost:3000/docs`   |
| Auth service      | `http://localhost:3001`        |
| Admin frontend    | `http://localhost:4000`        |
| User frontend     | `http://localhost:5000`        |
| Landing           | `http://localhost:6060`        |
| Neo4j Browser     | `http://localhost:7474`        |
| Mongo Browser     | `http://localhost:8081`        |

## Project structure

```
.
├── apps/
│   ├── api/           # Express + ts-rest API (port 3000)
│   ├── auth-service/  # Express + ts-rest auth service, RS256/JWKS (port 3001)
│   ├── admin-front/   # React + Vite (port 4000)
│   ├── user-front/    # React + Vite + Tailwind (port 5000)
│   └── landing/       # React + Vite landing site (port 6060)
├── packages/
│   ├── contracts/     # ts-rest + Zod API contracts (shared)
│   ├── hooks/         # Shared React auth (AuthProvider, useAuth, ProtectedRoute)
│   ├── config/        # Centralized frontend runtime config (service URLs)
│   ├── satan/         # SATAN QL — bridge to a Python worker for SQL-like Mongo queries
│   ├── ui/            # Shared React component library
│   ├── eslint-config/
│   └── typescript-config/
├── documentation/
├── docker-compose.yml        # Dev stack (hot reload), profile-gated (core / contracts)
└── docker-compose.prod.yml   # Production stack (nginx, compiled), profile-gated
```

## Common commands

All commands run from the repo root via Turborepo:

```bash
npm run dev       # Start all apps in watch mode
npm run build     # Build all apps
npm run lint      # Lint all packages with EsLint
npm run format    # Prettier format all .ts/.tsx/.md files
```
