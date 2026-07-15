# Product Roadmap

> Derived from a full audit of the codebase (working tree, branch `etienne`) cross-referenced against `documentation/`, `README.md`, `TODO.md`, and `ToDefine.md`. Effort is relative (S ≈ <1 day, M ≈ a few days, L ≈ a week+ for the group). Every claim below is tied to a file/endpoint so it can be verified.

---

## 1. Current state (verified)

### 1.1 What exists and works

| Area                                          | State                                                                                                                                                                                                                                                         | Evidence                                                                              |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **auth-service** (`apps/auth-service`, :3001) | **Complete** and matches `documentation/auth-service.md`. RS256/JWKS, argon2, refresh rotation (sha256-hashed, httpOnly cookie scoped `/auth`), email verification, password reset, TOTP/MFA enroll·confirm·disable, self-hosted `/login` + `/register` HTML. | `routes/auth/auth.router.ts`, `use-cases/*`, `keys.ts`, `index.ts:73-80`              |
| **api** (`apps/api`, :3000)                   | **CRUD-complete** across 12 domains, ~70 endpoints. ts-rest contract-first, clean layering (route → use-case → repository), DI container. Scalar API docs live.                                                                                               | `routes/**`, `use-cases/**`, `index.ts:115-130` (`/health`, `/openapi.json`, `/docs`) |
| **JWT resource-server auth**                  | `requireAuth` / `requireRole` verify access tokens via `createRemoteJWKSet`.                                                                                                                                                                                  | `apps/api/src/middleware/auth.middleware.ts`                                          |
| **Shared contracts**                          | `packages/contracts` is the real source of truth (ts-rest + zod), consumed by api.                                                                                                                                                                            | `packages/contracts/src/*.contract.ts`                                                |
| **Shared auth hooks**                         | `AuthProvider`, `useAuth`, `ProtectedRoute`, proactive refresh + 401 retry interceptor.                                                                                                                                                                       | `packages/hooks/*`, `apps/user-front/src/api-service/api.ts`                          |

### 1.2 Documented vision vs. reality — the differentiators are **not** built

| Documented feature                                                                                | Doc                                           | Status                | Evidence                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------- | --------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Recommendation feed** (Neo4j graph, tag/social/recency scoring, view & reply interest tracking) | `recommendation-algorithm.md`, `MCD/neo4j.md` | ❌ **0%**             | Neo4j container provisioned (`docker-compose.local.yml:25`) but **no driver dependency, no code** — only a comment in `use-cases/events/attend-event.use-case.ts`. `GET /listings/feed` and `POST /listings/:id/view` are documented but **absent** from `listings.contract.ts`.  |
| **Documenso e-signature**                                                                         | `documenso-integration.md`                    | ⚠️ **cosmetic stub**  | `contract.entity.ts` has `documensoDocumentId` / `signatureStatus` (enum), but `sign-contract.use-case.ts` just persists whatever the client sends — **no Documenso client, no document generation, no webhook, no `react-pdf`, no Documents page**. Signatures are unverifiable. |
| **District boundary editor** (Leaflet/geoman admin map)                                           | `district-boundary-editor.md`                 | ❌ **0% UI**          | Districts CRUD API + GeoJSON exist; admin app is empty, no `leaflet` dependency.                                                                                                                                                                                                  |
| **Address → district inference / autocomplete** (geocoding, point-in-polygon)                     | `ToDefine.md`                                 | ⚠️ **partial**        | `apps/api/src/services/address.service.ts` exists; geo-inference loop not wired end-to-end.                                                                                                                                                                                       |
| **SATAN QL** (custom Mongo query language, Python PLY, `@repo/satan`)                             | `satan-ql.md`, `architecture.md`              | ❌ **does not exist** | No `packages/satan` / `packages/SATAN`.                                                                                                                                                                                                                                           |
| **sync-gateway** (H2↔Mongo bridge for a Java app)                                                 | `sync-gateway.md`                             | ❌ **does not exist** | No `apps/sync-gateway`; no Java app in repo. Doc is unfinished (Deduplication ends in `????`, port "TBD").                                                                                                                                                                        |

### 1.3 Frontend product surface (user-front)

Only **1 of ~70 endpoints** is wired (`getAllAnnonces`). The core loop is **not completable in the UI.**

| Route / page            | File                              | State                                                                                                                                    |
| ----------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `/` Dashboard → Points  | `pages/dashboard/Points.tsx`      | **Hardcoded fake data** ("42 points / Donnée 8 / reçu 5 / Echangé 12") — not wired to `GET /users/:id/balance`.                          |
| `/service/annonces`     | `pages/service/Annonces.tsx`      | **Read-only list** (the one real integration). No detail, no create.                                                                     |
| `/service/mes-annonces` | `pages/service/AnnoncesUser.tsx`  | Stub `<div>`.                                                                                                                            |
| `/service/mes-contrats` | `pages/service/Contrat.tsx`       | Stub `<div>`.                                                                                                                            |
| `/evenement`            | `pages/Evenement.tsx`             | Stub `<div>`.                                                                                                                            |
| `/messagerie`           | `pages/Messagerie.tsx`            | Stub `<div>`.                                                                                                                            |
| `/documents`, `/votes`  | (none)                            | **Dead nav links** in `component/Header.tsx` — no routes.                                                                                |
| Login / Register        | `pages/auth/{Login,Register}.tsx` | **Orphaned** — import `@repo/ui` forms but are **not in the router**. Auth actually happens via redirect to auth-service's hosted pages. |
| **admin-front** (:4000) | `apps/admin-front/src/`           | **Empty shell** — `main.tsx` + `style.css` only (28 LOC). No admin features exist.                                                       |

### 1.4 Product-level issues found in audit

| #   | Severity   | Issue                                                                                                                                                                                                                   | Location                                        |
| --- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| A1  | **High**   | **No authorization/ownership enforcement model** — use-cases take ids but ownership checks are inconsistent; IDOR risk (act on another user's resource). Listed unresolved in `ToDefine.md`.                            | `apps/api/src/use-cases/**`, `routes/**`        |
| A2  | **High**   | **Signatures are forgeable** — `sign-contract` trusts client-supplied `signatureStatus`/`documensoDocumentId`.                                                                                                          | `use-cases/contracts/sign-contract.use-case.ts` |
| A3  | **High**   | **No sensitive-data privacy / GDPR story** — `users` stores `address`/`phone`/`email` with no documented access control or export/delete rights.                                                                        | `MCD/mongo.md`, `ToDefine.md`                   |
| A4  | **Medium** | **No rate limiting** anywhere, incl. auth endpoints (login, forgot-password, TOTP) → brute-force / enumeration exposure.                                                                                                | `apps/auth-service`, `ToDefine.md`              |
| A5  | **Medium** | **Fake data shown as real** (Points card) → misleading demo.                                                                                                                                                            | `pages/dashboard/Points.tsx`                    |
| A6  | **Medium** | **Dead nav + orphaned auth pages** → broken UX and maintenance traps.                                                                                                                                                   | `component/Header.tsx`, `pages/auth/*`          |
| A7  | **Low**    | **Doc drift** — `architecture.md` references `docker-compose.prod.yml` and `packages/SATAN` (neither exists); `README.md` is stock Turborepo boilerplate omitting auth-service/contracts; `sync-gateway.md` unfinished. | `documentation/*`, `README.md`                  |
| A8  | **Low**    | **Near-zero tests** — `playwright_testbook` is a documented stub with no runnable specs, pending stack-provisioned E2E (see `playwright_testbook/README.md`).                                                           | `playwright_testbook/`                          |
| A9  | **Info**   | **Large uncommitted WIP** on `etienne` (67 files, +606/−343), broadly threading auth through routes/use-cases. Reconcile/commit before building on top.                                                                 | working tree                                    |

---

## 2. Guiding strategy

**Build the core exchange loop end-to-end with _simple_ versions of the two hard features first, then upgrade them to the documented versions.**

- The simple feed (district filter + recency) and simple contract (in-app mutual accept) are demoable for a fraction of the effort of Neo4j scoring and Documenso.
- They generate the data the fancy versions need: view/reply events for the recommendation graph, real contracts for Documenso. Building Neo4j scoring against an empty graph, or Documenso before contracts are reachable in the UI, is wasted effort.
- **One complete vertical slice beats twelve half-slices** for a credible demo.

The work splits into **two parallel tracks** a group should staff separately:

- **Track A — Product** (Phases 0–4, §3–§7): the user-facing application.
- **Track B — Graded platform components** (§8): **SATAN QL** and **sync-gateway**. These are _grading requirements_, not product choices — they are mandatory, carry their own marks, and **must not be left to the end**. They are largely independent of the product loop (different skill sets: Python parser, sync service) so they proceed in parallel with Track A. _(The **Java app** is an existing deliverable in a separate repository — out of scope here; sync-gateway must conform to the contract that app already expects.)_

Dependency order:

- **Track A:** Phase 0 (foundations) → Phase 1 (loop) → Phase 2 (feed) ∥ Phase 3 (trust+admin) → Phase 4 (governance). Phases 2 and 3 parallelize once Phase 1 lands.
- **Track B:** B1 (SATAN) is independent and can start immediately. B2 (sync-gateway) must first close its open spec (B2-0) **against the existing Java app's actual outbox/poll behaviour** — the contract is fixed by that app, not by us.
- **Shared prerequisite:** sync-gateway reuses the Mongo entities and the auth-service from Track A's existing code — no Track-A phase blocks Track B, but Track B should agree on the synced-collection set with whoever owns the entities.

---

## 2A. District & role model (v2 — feature change)

_Supersedes the single-district assumptions in `district-boundary-editor.md`, `MCD/mongo.md`, and `auth-service.md`._

**Rules**

- Districts **may overlap**. A user's geocoded address can fall inside several district polygons → an **eligible set**.
- A user has **one active district at a time**, chosen from the eligible set, switchable later. All resource scoping (feed, listings, events, votes, incidents) uses the **active** district.
- If the eligible set is **empty**, the user may **create a district by drawing its polygon** (same editor as admins) and is **promoted to admin** of it.
- **Roles:** `user` (member) · `admin` (governs exactly **one** district; a district may have **several** admins) · `superAdmin` (company employee; read/manage **all** districts). _(`service` is **not** a user role — it's an internal short-lived machine-token claim used auth-service→api for the register flow.)_
- **Admin authority is independent of active-district choice** — admin of X stays admin of X even after switching active district to Y.

**Data model changes**

- `users`: drop single `districtId`; add `activeDistrictId` (mutable, drives scoping) and `location` (geocoded `{lng,lat}`). The eligible set is **derived** via point-in-polygon (cache only if perf demands).
- District-admin is a **relationship** (`districtId ↔ userId`) — a `districtAdmins` collection or `admins: [userId]` on the district; **one district per admin** enforced on write, **many admins per district** allowed.
- `districts`: name **no longer unique** (overlap + many districts); keep the geospatial index on the boundary.

**JWT claims** (decision: claims in token)

- Access token carries `role` and `adminDistrictId: string | null` (single — one district per admin); `superAdmin` is global.
- auth-service reads the admin relationship at login/refresh to mint the claim (read-only extension of its current `users` access).
- **Staleness:** promotion/demotion lands on next refresh (≤15 min). **Force a token refresh immediately after self-service creation/promotion** so the admin UI unlocks at once. Active-district _scoping_ stays server-side (api reads `activeDistrictId`), so switching is instant and needs no refresh.

**Docs to revise:** `district-boundary-editor.md` (overlap, plural inference, name not unique, user-initiated creation), `MCD/mongo.md` (user fields + admin relation), `auth-service.md` (new claim + admin read), `ToDefine.md` (geocoding & authorization now decided).

---

## 3. Phase 0 — Foundations _(blocks everything)_

_Goal: the app is safe for a second user, geo-scoping works, no misleading/broken surface._

**P0-1 — Authorization model (district-scoped)** · **L** · fixes A1 · see §2A

- Implement the role model from §2A — enum `user | admin | superAdmin` (plus the internal `service` machine claim).
- Enforce ownership **and district scoping** in every mutating use-case: a caller may modify a resource only if they own it, are `admin` of that resource's district, or are `superAdmin`. List/read scopes to the caller's **active district** unless `superAdmin`.
- Authority comes from the JWT (`role`, `adminDistrictId`); add a district-aware guard (`requireDistrictAdmin(resourceDistrictId)`) alongside `requireRole`.
- Lock the `role:"service"` JWT path (register→`POST /users`) to the auth-service only.
- Files: `middleware/auth.middleware.ts`, `apps/api/src/use-cases/**`, `routes/**`, auth-service token-issuing.
- **Done when:** an admin of district X gets `403` acting on district Y; a member gets `403` on others' resources; `superAdmin` passes; covered by a Playwright spec.

**P0-2 — Geocoding + district eligibility** · **M** · unblocks all geo-scoping · see §2A

- Geocode `users.address` → `location {lng,lat}` (cartes.gouv.fr geocoder); finish `apps/api/src/services/address.service.ts`.
- Point-in-polygon (turf `booleanPointInPolygon`) over all district boundaries → eligible set; persist `activeDistrictId`; endpoints to list eligible districts and switch the active one.
- **Migration:** existing users have an `address` string + single `districtId` → geocode to `location`, set `activeDistrictId` from the old `districtId`.
- **Done when:** a new user's eligible set is computed from their address, they have an `activeDistrictId`, and scoping queries use it.

**P0-3 — Frontend hygiene** · **S** · fixes A5, A6

- Wire `Points.tsx` to `GET /users/:id/balance` + `GET /users/:id/transactions`.
- Remove dead nav (`/documents`, `/votes`) from `Header.tsx` (or stub real routes).
- Delete orphaned `pages/auth/{Login,Register}.tsx` (redirect-to-auth-service already works) — or commit to in-app auth and wire them; do not keep both.
- **Done when:** no route 404s from nav; no hardcoded balances.

**P0-4 — Reconcile WIP + repo hygiene** · **S** · fixes A9, A7

- Review/commit the uncommitted `etienne` diff; rebase onto a clean `feat/*` branch.
- Fix `architecture.md` dangling refs; rewrite `README.md` to describe the real product + apps (incl. auth-service).
- **Done when:** `git status` clean, docs reference only things that exist.

---

## 4. Phase 1 — Core exchange loop (the demo) _(one complete vertical slice)_

_Goal: a user can post a service, be discovered, message, contract, and transfer points — end to end in the UI._

**P1-0 — District onboarding & switching** · **M** · see §2A

- After login, if `activeDistrictId` is unset, show the eligible districts (from P0-2) and let the user pick one; persist the choice.
- District switcher in the header that re-scopes the app to the chosen active district.
- **Empty eligible set →** user draws a polygon (Leaflet/geoman, the shared editor extracted in P3-2) to create a district; on save they're promoted to admin and the client **forces a token refresh** to load the `adminDistrictId` claim.
- **Done when:** a user with no eligible district can create one and immediately sees admin tools; a multi-eligible user can pick and later switch.

**P1-1 — Listings UI (full CRUD)** · **L**

- List/feed V1: `GET /listings` filtered by the user's **active** district + ordered by recency, paginated.
- Detail page: `GET /listings/:id`.
- Create/edit/delete (fill `AnnoncesUser.tsx` "Mes annonces"): `POST/PATCH/DELETE /listings`.
- Replace the ad-hoc `getAllAnnonces` with a typed ts-rest client consuming `@repo/contracts` (kills `type/annonce.ts` drift).
- **Done when:** a user can publish a listing and another user in the same district sees it.

**P1-2 — Messaging UI** · **M**

- "Contact" on a listing → `POST /conversations` → thread (`GET/POST /conversations/:id/messages`, `PATCH /messages/:id/read`).
- Fill `Messagerie.tsx`.
- **Done when:** two users exchange messages from a listing with read receipts.

**P1-3 — Contracts V1 + points transfer** · **L** · supersedes A2 later

- Create contract from a listing: `POST /contracts` (provider/beneficiary/price from listing).
- **In-app mutual accept** (defer Documenso): both parties accept → contract completes.
- On completion, move points: `POST /transactions` debiting beneficiary / crediting provider; enforce non-negative balance atomically.
- Fill `Contrat.tsx` "Mes contrats".
- **Done when:** completing a contract transfers points and both balances reflect it; double-completion is rejected.

**P1-4 — Events + Votes UI (read+participate)** · **M** _(optional within Phase 1; promotes "community" angle)_

- Events: list/detail/register/attend (`/events`, `/events/:id/register`, `/attend`) — fill `Evenement.tsx`.
- Votes: list/detail/respond/results (`/votes`, `/votes/:id/responses`, `/results`) — add the `/votes` route the nav already points at.

---

## 5. Phase 2 — Recommendation feed (headline differentiator)

_Goal: the documented graph-ranked feed, now that Phase 1 produces real signals._ Implements `recommendation-algorithm.md` + `MCD/neo4j.md`.

**P2-1 — Neo4j integration** · **M**

- Add the driver; projection layer mirroring Mongo writes into nodes/relationships (`User`, `Listing`, `Tag`, `District`; `LIVES_IN`, `PUBLISHED`, `TAGGED`, `KNOWS`).
- New repository + DI registration following the existing pattern.

**P2-2 — Interest tracking (fire-and-forget)** · **S**

- `POST /listings/:id/view` (small delta) and the reply path (large delta) upsert `(:User)-[:INTERESTED_IN {score, updatedAt}]->(:Tag)` per the doc's per-event decay model. Must not block responses.

**P2-3 — Ranked feed** · **M**

- `GET /listings/feed`: **active-district** hard-filter, then composite score **tag 50% / social 30% / recency 20%**, paginated. Replaces the Phase-1 recency feed.
- **Done when:** a user's feed reorders measurably after viewing/replying to listings with given tags; new users fall back to recency (doc edge cases).

---

## 6. Phase 3 — Trust + operability _(parallelizable with Phase 2)_

**P3-1 — Documenso integration** · **L** · fixes A2 · implements `documenso-integration.md`

- API-side Documenso client (document creation from template, signer assignment), persist PDF URL + per-signer signing URLs + status; **webhook handler** (verify signature; map `completed`→complete, `declined`→disputed).
- Replace P1-3 mutual-accept with real signing; trigger points transfer on `document.completed`.
- Front: Documents list + detail/signing page (`react-pdf` preview → redirect to signing URL).
- **Done when:** a contract is signed via Documenso and the webhook (not the client) drives status + points transfer.

**P3-2 — Admin app (district-bound) + superAdmin** · **L** · see §2A

- Bootstrap `admin-front` (currently empty) with auth + district-aware guards: an `admin` sees only their `adminDistrictId`; a `superAdmin` sees all districts.
- **District boundary editor** (`district-boundary-editor.md`): Leaflet + react-leaflet + leaflet-geoman, draw/edit/save GeoJSON polygons; server-side validation (Polygon only, closed ring, ≥3 points; **overlap allowed, name not unique** per §2A). **Extract the editor into `packages/ui`** so the user-front creation flow (P1-0) reuses it.
- Scoped operations — incident moderation + stats (`/incidents`, `/incidents/stats`), contract disputes, vote management — all filtered to the admin's district; `superAdmin` is cross-district.
- `superAdmin` provisioning: seeded employees (not self-service).
- **Done when:** a district admin manages only their district, a `superAdmin` manages all, and the boundary editor is the same component used by user-front.

---

## 7. Phase 4 — Governance & hardening _(before any real users)_

**P4-1 — Privacy & GDPR** · **M** · fixes A3

- Per-field visibility controls for sensitive user data (who can see address/phone/email — `ToDefine.md`).
- GDPR rights: data access/export, modification, deletion, objection; privacy policy. Ensure deletion cascades (listings, messages, transactions, refresh tokens).

**P4-2 — Abuse hardening** · **S–M** · fixes A4

- Rate limiting (login, forgot-password, TOTP, register first), request body size limits, account-enumeration-safe responses.

**P4-3 — Delivery & quality** · **M** · fixes A8

- CI/CD (GitHub Actions: lint, build, Playwright); build out `playwright_testbook` (currently a documented stub pending stack-provisioned E2E) to cover the Phase 1 loop and authz (P0-1).
- Logging/observability; structured error responses (no internal leakage).

**P4-4 — Prod deploy** · **S** · from `TODO.md`

- Set prod env: `AUTH_PRIVATE_KEY`/`AUTH_PUBLIC_KEY` (else tokens die each restart), `RESEND_API_KEY`/`FROM_EMAIL` (else emails only `console.log`), `NODE_ENV=production` (secure cookies), `CORS_ORIGINS`, `AUTH_JWKS_URL`, `AUTH_PUBLIC_URL`.
- Run the one-shot `users` migration (`emailVerified`/`totpSecret`/`totpEnabled`) from `TODO.md`, else existing accounts lock out.
- Author the missing `docker-compose.prod.yml`.

---

## 8. Track B — Graded platform components _(mandatory, parallel to Track A)_

_Both are grading requirements. Neither exists in code today. Staff this track separately from the product work and start it early — it does not depend on the product loop._ Specs: `satan-ql.md`, `sync-gateway.md`.

### B1 — SATAN QL (`@repo/satan`)

_Goal: a SQL-like DSL compiled to MongoDB at runtime, parsed by a long-lived Python (PLY) process, consumed by the api through the existing repository → use-case → route layering._

**B1-1 — Python parser package** · **L**

- `packages/satan/python/`: PLY `lexer.py` → `parser.py` (grammar → AST) → `translator.py` (AST → Mongo query dict), driven by `worker.py`.
- Support the documented grammar: `FIND <collection> WHERE <expr> [SELECT ...] [ORDER BY ... ASC|DESC] [SKIP n] [LIMIT n]`; operators `=`, comparison (`>= <= > <`), `LIKE` (with `*` wildcards → regex), `IN (...)`, `EXISTS`, `AND`/`OR`/`NOT`, parentheses, nested field paths (`profile.address.city`).
- Protocol: read newline-delimited JSON on stdin (`{id, query}`), write `{id, ok, result|error}` on stdout. Terminate when stdin closes.
- **Done when:** every example in `satan-ql.md` parses to the correct Mongo filter/projection/sort.

**B1-2 — Node client (`SatanClient`)** · **M**

- `createSatanClient()` spawns the Python worker **once**, keeps it alive, correlates requests/responses by `id`, auto-restarts on crash, shuts down on api exit.

**B1-3 — api integration + safety** · **M**

- Wire through a repository + use-case + route (e.g. an admin/search query path) so SATAN is exercised end-to-end via DI.
- **Injection safety is mandatory:** allowlist queryable collections and fields; reject Mongo operator injection; never interpolate raw user strings into the translated query. Treat SATAN input as untrusted.
- **Done when:** an api endpoint answers a SATAN query against real data, and an injection attempt is rejected.

### B2 — sync-gateway (`apps/sync-gateway`)

_Goal: the bidirectional H2 ↔ MongoDB bridge the existing Java app talks to._ The Java app is fixed (separate repo), so the contract below is **discovered from that app, not invented here.**

**B2-0 — Close the spec** · **S** _(blocks B2-1+)_

- Resolve the unfinished **Deduplication** section (`sync-gateway.md` ends in `????`): confirm the business-key unique index per entity and the INSERT-retry-with-null-`mongoId` adoption flow **against what the Java app actually sends**.
- Assign the **port** (TBD in doc; taken: api 3000, admin 4000, user 5000, auth 3001, neo4j 7474) and register in `docker-compose*.yml` + `turbo.json`.
- Confirm the synced-collection set and payload shapes match the Java app's outbox.

**B2-1 — `POST /ingest`** · **M**

- Batch outbox events → Mongo: `INSERT` (generate ObjectId, insert with `_id = mongoId`, return `{id, mongoId}`), `UPDATE` (full `$set` by `_id`), `DELETE` (by `_id`); tag writes `origin:"sync"`; skip+log unknown entities; enforce ~5 MB body limit; idempotent INSERT-retry per B2-0.

**B2-2 — Change Streams watcher** · **M**

- Watch Mongo; skip `origin == "sync"`; append to `sync_changes` with an **atomically incremented `index`** (counters collection via `findOneAndUpdate`).

**B2-3 — `GET /changes?since=&limit=`** · **S**

- Cursor pagination over `sync_changes` (`since` default 0, `limit` default 100).
- **Done when:** an entity created in the Java app round-trips into Mongo and is visible in the api/user-front, and an api-side write surfaces via `/changes` and lands in the Java app's H2.

### Deferred within scope

- **`RECOMMENDED` / event recommendations** (Neo4j `RECOMMENDED` edge): defer to post-Phase-2 — the listing feed is the higher-value first recommendation surface.

---

## 9. Open questions (answers change the plan)

1. **sync-gateway contract (B2-0)** — the Java app (separate repo) is the fixed counterparty. Before building, read that app's outbox/poll code to confirm the synced-collection set, payload shapes, and the dedup behaviour the doc leaves as `????`. Also pick the gateway port.
2. **SATAN integration surface (B1-3)** — which api query path(s) run through SATAN? Pick at least one real one (e.g. admin user/listing search) so it's demonstrably wired, not a toy.
3. **Auth UI direction** — keep auth-service hosted pages (current working path) or move login/register in-app? Decides P0-3.
4. **Real money/legal weight on contracts?** If signatures must be legally binding, P3-1 (Documenso) is non-negotiable and moves earlier; if "points are a game", P1-3 mutual-accept may suffice for v1.

---

## Appendix A — Endpoint inventory (implemented)

`auth` (12): login · login/mfa · refresh · logout · csrf · userinfo · register · verify · resend-verification · forgot-password · reset-password · totp/{enroll,confirm,disable}
`users` (5 + 2): CRUD · `/users/:id/transactions` · `/users/:id/balance`
`districts` (5): CRUD · `listings` (5): CRUD · `tags` (5): CRUD · `notifications` (5): list/create/read/read-all/delete
`contracts` (6): list · get · create · sign · dispute · delete
`events` (8): CRUD · register · unregister · attend
`votes` (7): CRUD · responses · results
`incidents` (6): CRUD · stats
`conversations`/messages (8): conversations CRUD-ish · messages list/send/read · media
`transactions` (2): list · create

**Documented but missing:** `GET /listings/feed`, `POST /listings/:id/view` (Phase 2); Documenso webhook (Phase 3).

## Appendix B — Effort summary

| Track / Phase | Theme                                                 | Size |
| ------------- | ----------------------------------------------------- | ---- |
| A · 0         | Foundations (authz, districts, hygiene)               | M    |
| A · 1         | Core loop (listings, messaging, contracts+points)     | L    |
| A · 2         | Recommendation feed (Neo4j)                           | M–L  |
| A · 3         | Trust + admin (Documenso, admin app)                  | L    |
| A · 4         | Governance & hardening (GDPR, rate limit, CI, deploy) | M    |
| B · 1         | SATAN QL (Python PLY parser + Node client + api wire) | L    |
| B · 2         | sync-gateway (ingest + Change Streams + changes)      | M    |

_Tracks A and B run in parallel; B is graded and must not be back-loaded._
