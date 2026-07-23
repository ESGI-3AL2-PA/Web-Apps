# Architecture Schema

Visual overview of the **Connected NeighBours** platform — a district-scoped
neighbourhood service exchange built as a Turborepo + npm workspaces monorepo.

This file complements the prose in [`architecture.md`](./architecture.md) with
rendered diagrams. Every diagram below is Mermaid and renders on GitHub.

---

## 1. System / container view

How the pieces fit together at runtime: actors, the production edge, the five
apps, the datastores, and the external Documenso e-signature stack. In dev the
apps are reached directly on their ports; in prod a Caddy reverse proxy
terminates TLS in front of them.

```mermaid
flowchart TB
  resident["Resident (browser)"]
  admin["District admin (browser)"]
  visitor["Visitor"]
  desktop["JavaFX desktop app<br/>(embedded H2, offline-first)"]

  subgraph edge["Edge (prod only)"]
    caddy["Caddy reverse proxy<br/>TLS / Let's Encrypt"]
  end

  subgraph fronts["Frontends — React 19 + Vite + Tailwind 4"]
    landing["landing :6060<br/>marketing site"]
    userfront["user-front :5000<br/>resident SPA"]
    adminfront["admin-front :4000<br/>admin console"]
  end

  subgraph backend["Backend — Express + ts-rest"]
    api["api :3000<br/>resource server + Socket.IO"]
    auth["auth-service :3001<br/>tokens, TOTP, JWKS"]
  end

  subgraph data["Datastores"]
    mongo[("MongoDB :27017<br/>domain data")]
    neo4j[("Neo4j :7687<br/>social / district graph")]
    satan["SATAN worker (Python)<br/>SQL-like to Mongo"]
  end

  subgraph ext["External integrations"]
    documenso["Documenso :3030<br/>e-signature"]
    pg[("Postgres :5432")]
    minio[("MinIO :9000<br/>S3 object store")]
    mail["mailpit / Resend<br/>SMTP + email"]
  end

  resident --> caddy
  admin --> caddy
  visitor --> caddy
  caddy --> landing
  caddy --> userfront
  caddy --> adminfront
  caddy --> api
  caddy --> auth
  caddy --> documenso

  userfront -->|"REST (ts-rest)"| api
  adminfront -->|"REST (ts-rest)"| api
  userfront <-->|"WebSocket"| api
  userfront -->|"login / refresh"| auth
  adminfront -->|"login / refresh"| auth
  desktop -->|"/sync/ingest + /sync/changes"| api
  desktop -->|"SSO / device auth"| auth

  api -->|"verify RS256 via JWKS"| auth
  api --> mongo
  api --> neo4j
  api --> satan
  satan --> mongo
  api -->|"contracts / signing"| documenso
  auth --> mongo
  auth -->|"emails"| mail

  documenso --> pg
  documenso --> minio
  documenso -->|"webhook"| api
```

---

## 2. Monorepo dependency graph

The five apps share code through the `packages/*` workspaces.
`@repo/contracts` is the architectural core — the single source of truth for
every request/response shape, imported by both servers and clients.

```mermaid
flowchart LR
  subgraph apps["apps/"]
    api2["api"]
    authsvc["auth-service"]
    adminf["admin-front"]
    userf["user-front"]
    land["landing"]
  end
  subgraph packages["packages/"]
    contracts["@repo/contracts<br/>ts-rest + Zod (source of truth)"]
    shared["@repo/shared<br/>mongo, env, container, schemas"]
    hooks["@repo/hooks<br/>auth (AuthProvider, useAuth)"]
    config["@repo/config<br/>runtime URLs"]
    satanp["@repo/satan<br/>Mongo QL bridge"]
    theme["@repo/theme"]
    types["@repo/types"]
    tsconfig["@repo/typescript-config"]
    eslintc["@repo/eslint-config"]
  end

  api2 --> contracts
  api2 --> shared
  api2 --> satanp
  api2 --> types
  authsvc --> contracts
  authsvc --> shared
  authsvc --> types
  adminf --> contracts
  adminf --> hooks
  adminf --> config
  adminf --> theme
  userf --> contracts
  userf --> hooks
  userf --> config
  userf --> theme
  land --> theme
  contracts --> types
```

> `@repo/typescript-config` and `@repo/eslint-config` are dev-time tooling
> bases consumed by every workspace; edges are omitted to keep the graph
> readable.

---

## 3. API — contract-first Clean Architecture

`apps/api` is a resource server organised in three concentric layers. The
contract package feeds both the typed frontend client and the server router, so
the API is type-safe end to end without code generation.

```mermaid
flowchart TB
  contract["@repo/contracts<br/>endpoint + Zod DTO<br/>(single source of truth)"]
  contract -->|"typed client"| client["Frontend client<br/>(ts-rest)"]
  contract -->|"typed router"| routes

  subgraph apiapp["apps/api — Clean Architecture"]
    direction TB
    mw["Middleware<br/>requireAuth / requireRole (JWKS)"]
    routes["Layer 1 — Routes<br/>thin controllers"]
    uc["Layer 2 — Use cases<br/>business logic"]
    repo["Layer 3 — Repositories<br/>data access"]
    mw --> routes
    routes --> uc
    uc --> repo
  end

  client -->|"HTTP request"| mw
  repo --> mongo[("MongoDB")]
  repo -->|"graph projection"| neo4j[("Neo4j")]
  uc --> io["Socket.IO<br/>real-time push"]
  watcher["Change-Streams watcher<br/>(offline-sync)"] --> mongo
```

Domain modules follow the same routes → use-cases → repositories shape:
`users`, `districts`, `district-admins`, `listings`, `events`, `votes`,
`incidents`, `conversations`, `notifications`, `transactions`, `contracts`,
`tags`, `recommendations`, and `sync`.

---

## 4. Authentication flow (JWT RS256 + JWKS)

The `auth-service` owns credentials and issues tokens; the `api` never sees
passwords. It verifies access tokens against the auth-service JWKS, so there is
no shared secret between the two services.

```mermaid
sequenceDiagram
  actor U as User (SPA)
  participant AF as Front (@repo/hooks)
  participant AS as auth-service :3001
  participant API as api :3000
  participant M as MongoDB

  U->>AF: submit credentials
  AF->>AS: POST /auth/login
  AS->>M: verify argon2 hash (+ TOTP)
  AS-->>AF: RS256 access token + refresh cookie (httpOnly, /auth)
  AF->>API: GET /resource (Bearer access token)
  API->>AS: fetch JWKS (/.well-known/jwks.json)
  API->>API: verify RS256 signature + role
  API-->>AF: 200 resource
  Note over AF,AS: on 401, POST /auth/refresh (opaque token) then retry
```

- **Access tokens** — short-lived RS256 JWTs signed with `AUTH_PRIVATE_KEY`;
  the public key is published at `GET /.well-known/jwks.json`.
- **Refresh tokens** — opaque 64-byte hex, stored as sha256 in Mongo, delivered
  in an httpOnly cookie scoped to `/auth`.
- **Register** runs in the auth-service but creates the user through
  `POST API_URL/users`, authenticated with a short-lived self-signed
  `role: "service"` JWT.
- **Logged-out pages** — the auth-service also serves the standalone HTML
  screens for the credential flows: `/login`, `/register`, `/forgot-password`
  (enumeration-safe reset request) and the emailed `/reset-password` link.

---

## 5. Deployment topology

Both compose files describe the same services; they differ in intent.

| Concern       | `docker-compose.yml` (dev)                   | `docker-compose.deploy.yml` (prod)                     |
| ------------- | -------------------------------------------- | ------------------------------------------------------ |
| App images    | built from source, `dev` target, bind mounts | `ghcr.io/esgi-3al2-pa/web-apps/<app>` (nginx-served)   |
| TLS / routing | direct host ports                            | Caddy reverse proxy, Let's Encrypt                     |
| Secrets       | zero-config local credentials                | SOPS-decrypted env at deploy                           |
| Static hosts  | Vite dev server                              | `nginx-unprivileged` sending hardened security headers |
| Hot reload    | yes (`turbo run dev`)                        | no                                                     |

```mermaid
flowchart LR
  subgraph net["Docker network"]
    caddy["Caddy :443"]
    subgraph appsvc["App services"]
      land2["landing"]
      user2["user-front"]
      admin2["admin-front"]
      api3["api"]
      auth3["auth-service"]
    end
    subgraph stores["Stateful services"]
      mongo2[("MongoDB<br/>replica set")]
      neo["Neo4j"]
      docu["Documenso"]
      pg2[("Postgres")]
      minio2[("MinIO")]
      mp["mailpit"]
    end
  end

  caddy --> land2
  caddy --> user2
  caddy --> admin2
  caddy --> api3
  caddy --> auth3
  caddy --> docu
  api3 --> mongo2
  api3 --> neo
  auth3 --> mongo2
  docu --> pg2
  docu --> minio2
```

> MongoDB runs as a **replica set** — the Change-Streams watcher powering
> offline sync (`db.watch()`) requires one; it throws on a standalone mongod.

> The fronts bake their public `VITE_*` URLs into the bundle at build time
> (`VITE_API_URL`, `VITE_AUTH_SERVICE_URL`, `VITE_APP_URL`, `VITE_ADMIN_URL`,
> `VITE_LANDING_URL`). CD extracts them from `prod.enc.env` and passes them as
> Docker build args, so a URL change means a rebuild, not just a restart.

---

## Related documentation

- [`architecture.md`](./architecture.md) — full prose walkthrough
- [`auth-service.md`](./auth-service.md) — token flows in detail
- [`sync-gateway.md`](./sync-gateway.md) — offline sync (H2 ↔ MongoDB)
- [`satan-ql.md`](./satan-ql.md) — the SATAN query language
- [`documenso-integration.md`](./documenso-integration.md) — e-signature
- [`MCD/mongo.md`](./MCD/mongo.md) · [`MCD/neo4j.md`](./MCD/neo4j.md) — data models
