# Getting Started

This guide covers everything you need to set up a local development environment for this project.

## Prerequisites

| Tool    | Version | Notes                  |
| ------- | ------- | ---------------------- |
| Node.js | 25      | Install with NVM       |
| npm     | 11+     | —                      |
| Docker  | Latest  | Required for databases |
| Git     | Any     | —                      |

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

## 3. Start the databases

Two Docker Compose files are available depending on your workflow:

### Option A — Databases only (recommended for local dev)

Run only MongoDB and Neo4j, and start the API directly with Node:

```bash
docker compose -f docker-compose.local.yml up -d
```

Then start the full dev server:

```bash
nvm install latest && nvm use latest
npm run dev
```

### Option B — Full stack in Docker

Run everything (API + databases) inside Docker:

```bash
docker compose up
```

> The API container mounts the repo root as a volume and watches for changes, so live reload still works.

## 4. Verify everything is running

| Service           | URL                            |
| ----------------- | ------------------------------ |
| API               | `http://localhost:3000`        |
| API Health check  | `http://localhost:3000/health` |
| API Docs (Scalar) | `http://localhost:3000/docs`   |
| Admin frontend    | `http://localhost:4000`        |
| User frontend     | `http://localhost:5000`        |
| Neo4j Browser     | `http://localhost:7474`        |
| Mongo Browser     | `http://localhost:8081`        |

## Project structure

```
.
├── apps/
│   ├── api/          # Express API (port 3000)
│   ├── admin-front/  # React 19 + Vite (port 4000)
│   └── user-front/   # React 19 + Vite (port 5000)
├── packages/
│   ├── contracts/    # ts-rest + Zod API contracts (shared)
│   ├── ui/           # Shared React component library
│   ├── eslint-config/
│   └── typescript-config/
├── documentation/
├── docker-compose.yml        # Full stack (API + DBs)
└── docker-compose.local.yml  # DBs only
```

## Common commands

All commands run from the repo root via Turborepo:

```bash
npm run dev       # Start all apps in watch mode
npm run build     # Build all apps
npm run lint      # Lint all packages with EsLint
npm run format    # Prettier format all .ts/.tsx/.md files
```
