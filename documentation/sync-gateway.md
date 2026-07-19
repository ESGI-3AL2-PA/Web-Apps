# Offline Sync (H2 ↔ MongoDB) — merged into `apps/api`

> ## Status: approved design, not yet implemented
>
> This is the **source-of-truth design** for the offline-sync feature that bridges the companion JavaFX
> app's embedded **H2** database and the platform's **MongoDB**. It supersedes the earlier
> "sync-gateway" proposal (a standalone Node service). **There is no separate `sync-gateway` service** —
> its endpoints, the Change-Streams watcher, and the conflict store are **folded into `apps/api`**.
>
> The filename is kept as `sync-gateway.md` to preserve inbound links (ROADMAP, getting-started); the
> "gateway" is now a set of routes inside the api.
>
> **Not to be confused with** the live Mongo → Neo4j projection in
> `apps/api/src/repositories/Graph/graph.sync.ts` (a one-way graph mirror). This feature is a
> bidirectional bridge to the desktop app's H2 database.

---

## 1. Why this changed (merge rationale)

Two stale feature branches held the original implementation:

- **Server** — a standalone `sync-gateway` service on branch `feat/sync-gateway`, built **296 commits
  behind `origin/main`**. It predates `@repo/shared` (the `server-kit → shared` extraction, the
  single-source user schema, the dedup'd `_id↔id` mapper), district-gating, TOTP fields, and the GDPR
  PII-redaction work. Its own connector / shutdown / env-loader / DI container are now **obsolete**.
- **Client** — branch `feat/sync-gateway-flow`, **48 commits behind `origin/main`**. Upstream since
  gained everything the client rewrite needs (offline-first session + re-login, `ApiException`,
  district-integrated incidents, `BaseController`).

Neither branch is rebased. The feature is **re-applied fresh onto current `origin/main`**, and the
server side is **merged into `apps/api`** because:

- The api already owns the `users` / `incidents` collections and their schema (`@repo/shared`
  `userDocumentSchema`, `apps/api/src/entities/incident.entity.ts`). A separate writer with its own
  copy of those rules is a standing drift risk — folding in lets sync **source its write-model from
  `@repo/shared`** (single source of truth).
- The api already has JWT auth (`requireAuth` + the declarative `authorize` middleware), a DI
  container, graceful shutdown, and a shared Mongo client — everything the gateway re-implemented.
- One process, one deploy, one auth model.

---

## 2. Topology & data flow

```
                          apps/api  (Express + ts-rest, :3000)
 JavaFX instance A ─┐        │
 JavaFX instance B ─┼─POST /ingest──▶ ingest use-case ──▶ users / incidents (Mongo, _id = UUID)
 JavaFX instance N ─┘        │                                      │  (writes stamped _sync)
        ▲                    │                                      ▼
        │                    │                             Change-Streams watcher
        └── GET /changes ◀───┴── sync_changes (append-only, monotonic `index`) ◀── appends every change
            ?since=<cursor>                                                          (api-origin + sync-origin)

 JavaFX instance X ── GET /conflicts?mine · POST /conflicts/:id/resolve ──▶ conflicts use-cases ──▶ sync_conflicts
```

Each JavaFX instance always initiates:

1. Drains its local **keyed pending-changes** table and **pushes** (`POST /ingest`).
2. **Polls** `GET /changes?since=<cursor>` and applies Mongo-originated changes to H2.
3. Resolves the conflicts **its own** pushes raised, in the desktop UI (§6.5).

A background **Change-Streams watcher** inside the api observes the synced collections and appends every
change to `sync_changes` — the ordered feed the clients poll. Conflicts are quarantined in
`sync_conflicts` and **resolved by the operator in the desktop app** — there is no conflict surface in
admin-front (§6).

---

## 3. Auth model

`/ingest`, `/changes`, and `/conflicts*` are **authenticated api routes** — gated by the api's existing
`requireAuth` (RS256 JWT verified against the auth-service JWKS) + the declarative `authorize`
middleware driven by each route's `metadata.auth({...})`. There is **no shared secret** (the old gateway
used one); the desktop app sends its **operator's real user JWT**.

| Routes                | Policy                                                                                                                 |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `/ingest`, `/changes` | `auth({ audience: "api", roles: ["admin","superAdmin"] })` + **district scoping** (§5.5) — see Decision D1             |
| `/conflicts*`         | `auth({ audience: "api", roles: ["admin","superAdmin"] })` — consumed only by the desktop app (no admin-front surface) |

### Client token lifecycle (browser-SSO reality)

`origin/main`'s client authenticates via `auth/SsoAuthService` — an RFC-8252 browser loopback login that
places an RS256 **access token in memory**; the opaque **refresh token is an HttpOnly cookie held by the
browser** on the auth-service origin. **The Java process never sees the refresh token**, so there is no
in-process silent refresh. Consequences the client design must handle (see §9):

- `SsoAuthService.getAccessToken()` throws `TokenUnavailableException` when the in-memory token is expired.
- A sync cycle that hits this (or gets a `401`) transitions to `SyncStatus.AUTH_REQUIRED`, which drives a
  browser re-login; the scheduler keeps ticking and resumes once a fresh token is in memory.

> ### Decision D2 — unattended auth _(provisional: accept interactive re-login — CONFIRM)_
>
> With browser-cookie refresh, an unattended box stalls at `AUTH_REQUIRED` when the browser's refresh
> cookie lapses, until an operator completes a browser login. **Default: accept this** (attended operator
> box; zero new auth surface). **Alternative:** add an in-process email+password `POST /auth/login` +
> `POST /auth/refresh` (CookieJar + CSRF double-submit) to `SsoAuthService` for true headless operation —
> a new credential surface to secure. Out of scope for the first cut unless confirmed.

---

## 4. Wire API

Contracts live in `packages/contracts` (`sync.contract.ts`, `conflicts.contract.ts`; DTOs in
`src/DTO/sync.dto.ts`, `src/DTO/conflict.dto.ts`). All shapes are zod, `import { z } from "../zod"`.

### 4.1 `POST /ingest`

Applies a batch of local events (max **100**). The client sends `X-Sync-Instance: <install-uuid>`.

**Request** — `IngestBatchDto` (`IngestEventDto[]`):

```json
[
  {
    "id": 42,
    "entity": "incident",
    "operation": "INSERT",
    "mongoId": null,
    "data": { "category": "voirie", "description": "…", "districtId": "d1", "reporterId": "u1" },
    "occurredAt": "2026-07-18T10:00:00.000Z"
  },
  {
    "id": 43,
    "entity": "user",
    "operation": "UPDATE",
    "mongoId": "0f8c…",
    "data": { "phone": "+33…" },
    "occurredAt": "2026-07-18T10:00:01.000Z",
    "baseUpdatedAt": "2026-07-17T09:00:00.000Z"
  }
]
```

`IngestEventDto`: `id:int` (the client's stable per-record correlation id), `entity`, `operation`
(`INSERT|UPDATE|DELETE`), `mongoId:string|null`, `data:Record<string,unknown>|null` (null for DELETE),
`occurredAt:datetime`, `baseUpdatedAt?:datetime` (optimistic-concurrency token for UPDATE/DELETE).

**Response** — `IngestResultDto`:

```json
{
  "applied": [
    { "id": 42, "mongoId": "6610…", "operation": "INSERT", "updatedAt": "2026-07-18T10:00:00.123Z" },
    { "id": 43, "mongoId": "0f8c…", "operation": "UPDATE", "updatedAt": "2026-07-18T10:00:01.456Z" }
  ],
  "conflicts": [{ "id": 71, "mongoId": "ab12…", "conflictId": "c-uuid" }],
  "rejected": [{ "id": 88, "reason": "out-of-district" }]
}
```

`rejected[]` carries events the server refused outright. Reasons: `out-of-district` (§5.5),
`read-only-entity` (a `district` push, §5.3), and `unprocessable` (structurally impossible — e.g. an
UPDATE/DELETE with `mongoId: null`, which has no server target). These are not conflicts: the client must
**drop the pending row** and surface the failure rather than retry, since retrying can never succeed.

> **Total-accounting invariant.** Every event id in the request appears in **exactly one** of `applied`,
> `conflicts`, or `rejected` — never zero, never two. The client keys its pending-row lifecycle off this
> (applied → clear + advance token; conflict → keep; rejected → drop). An event silently missing from all
> three would strand its pending row forever, retried every cycle. Server-side, any event that falls
> through the normal paths must still be emitted as `rejected` with `unprocessable`.

> **Key change from the old spec:** the ack **returns the post-write `updatedAt` per applied event**
> (`updatedAt` is `null` for an applied DELETE). This lets the client advance its optimistic-concurrency
> token (`base_updated_at`) **synchronously from the ack**, instead of having to wait to observe its own
> write echo back through the change feed. The returned `updatedAt` **must be the exact persisted value**
> (not a re-read) so it equals what the watcher later publishes to other instances.

Per-event processing is defined in §6 (conflict model).

### 4.2 `GET /changes?since=<cursor>&limit=<n>&excludeInstance=<id>`

Returns Mongo-originated changes for the client to apply to H2.

| Param             | Type | Default | Notes                                                                                          |
| ----------------- | ---- | ------- | ---------------------------------------------------------------------------------------------- |
| `since`           | int  | `0`     | Last `index` the caller processed. `since=0` is a full snapshot (see §5.2).                    |
| `limit`           | int  | `100`   | Max 500.                                                                                       |
| `excludeInstance` | str  | —       | Skip entries this instance originated (echo-skip). The router fills it from `X-Sync-Instance`. |

**Response** — `ChangeEntryDto[]`, `index`-ascending:

```json
[ { "index": 152, "entity": "user", "operation": "UPDATE", "mongoId": "0f8c…",
    "data": { "…redacted server doc…" }, "occurredAt": "…" } ]
```

`data` is `null` for DELETE and **redacted** of server-only fields (§5.3).

### 4.3 `/conflicts*` — consumed only by the desktop app

The conflict UI lives in the JavaFX app (§6.5); there is no admin-front surface. The operator sends the
same JWT + `X-Sync-Instance` they use for sync.

- **`GET /conflicts`** — query `{ status=pending, entity?, mine=true, limit=100 (max 200) }` → `ConflictDto[]`.
  With `mine=true` (default) the server returns only conflicts whose `originInstanceId` matches the
  caller's `X-Sync-Instance` — i.e. the conflicts **this operator's own pushes raised**. `mine=false` is
  allowed only for `superAdmin` (full view; see §6.5 orphan note).
- **`GET /conflicts/:id`** → `ConflictDto` or `404`.
- **`POST /conflicts/:id/resolve`** — body `{ resolution, data? }` where `resolution` is `local`,
  `server`, or `merged` (`data` required when `merged`) → `{ id, status:"resolved", resolution }`, or
  `400` / `404`.

`ConflictDto`: `id, entity, mongoId, type` (`update` or `duplicate`)`, originInstanceId, localData,
serverData, baseUpdatedAt?, status` (`pending` or `resolved`)`, detectedAt, resolvedAt?, resolvedBy?,
resolution?`. Server-only fields are redacted from `serverData`.

---

## 5. Server internals

### 5.1 Collections

| Collection           | Purpose                                                                                                                                                                                 |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`, `incidents` | The real domain collections (owned by the api). Sync writes go here, allowlisted (§5.3).                                                                                                |
| `sync_changes`       | Append-only outbound feed. Fields: `_id` (uuid), `index` (int, unique), `entity`, `operation`, `mongoId`, `data` (or null), `occurredAt`, `origin` (`api`/`sync`), `originInstanceId?`. |
| `sync_state`         | Watcher resume token (`_id:"watcher"`) + the one-shot `seeded` flag.                                                                                                                    |
| `sync_conflicts`     | Quarantined conflicts (§6); each carries `originInstanceId` (the instance whose push raised it) for the desktop `mine` filter.                                                          |
| `counters`           | `{ _id:"sync_changes", seq:int }` — atomic `$inc` hands out the monotonic feed `index`.                                                                                                 |

The feed `index` is a strictly-increasing integer from an atomic single-doc `$inc` (atomic in Mongo
without a transaction). Readers use `index > since` ascending, so a crash-gap between `next()` and the
`sync_changes` insert is harmless (never blocks).

### 5.2 First-boot feed seeding (single pull path)

On first boot, `seedExistingDocs(db)` (idempotent, guarded by the `sync_state.seeded` flag) streams every
existing doc of **each synced collection** (`users`, `incidents`, `districts`) and appends a synthetic
`INSERT` (`origin:"api"`, redacted `data`) to `sync_changes`. This makes **`GET /changes?since=0` a
complete snapshot**, so the client has **one pull path** and no longer needs a separate REST bootstrap.
The same `counter` backs both the seed and live stream, so indices stay monotonic.

### 5.3 Write-model sourced from `@repo/shared` (no duplicated entity-map)

`apps/api/src/sync/sync-entity-config.ts` **derives** the sync rules from the canonical schemas rather
than re-declaring them:

- **`writableFields`** = schema keys **minus** a `SERVER_OWNED` set, derived via `.keyof()`/`.shape` so
  new shared fields flow through automatically:
  - `user` → `email, firstName, lastName, phone, address, districtId`
  - `incident` → `reporterId, districtId, category, description, photoUrl, status, history, assignedTo`
- **`defaultsOnInsert`** (server-authoritative fields H2 never supplies):
  - `user` → `passwordHash:"!sync-imported-no-login"`, `role:"user"`, `balance:0`, `banned:false`,
    `emailVerified:false`, `totpSecret:null`, `totpEnabled:false` — a user first seen from H2 has a
    **non-usable password** (login disabled until provisioned via auth-service).
  - `incident` → `status:"open"`, `history:[]`.
- **`REDACTED_FIELDS`** = `passwordHash, totpSecret, lastTotpStep` — stripped from any `data` that leaves
  the server (change feed + conflict payloads), together with the internal `_sync` field. Honors the GDPR
  PII posture.

Every H2-originated write passes `pickWritable` (the allowlist), so server-only fields
(`role`, `balance`, `banned`, `passwordHash`, `totpSecret`, …) **can never be set from an untrusted H2
snapshot**.

**One-way (read-only) entities.** `district` (collection `districts`) is a synced entity but flows
**server → client only**: districts are created/managed on the web (#145) and the desktop merely reads
them (dropdown + readable names). Its config carries `ingestAllowed: false`, so the watcher observes
`districts` and the feed/seed carry district changes, but the **ingest use-case rejects any `district`
event** (logged + skipped, never written). No `writableFields`/`defaultsOnInsert` write path applies.

### 5.4 Provenance stamp (`_sync`)

Every sync-originated write stamps `_sync: { origin:"sync", occurredAt, instanceId }` on the doc. The
watcher reads it to tag `sync_changes` entries with `origin` + `originInstanceId` (which powers
`excludeInstance`). `_sync` is **modeled explicitly** as an optional internal field on the shared
user/incident document schemas (kept out of the entity/DTO schemas) and **stripped on read** by the
mappers / `redactServerDoc`, so it never leaks into API responses or the graph projection.

### 5.5 District scoping (D1)

The sync surface must not be broader than the interactive routes it shadows (see D1 / PR #151). Both
directions are scoped by the **caller's district**; `superAdmin` bypasses (sees/writes everything).

**Resolving the caller's district.** Reuse the existing helpers in
`apps/api/src/middleware/district-scope.ts` (`resolveCallerListDistrict`, `callerCanReadDistrict`) rather
than re-deriving — same source of truth as the incident/listing/tag/event/vote routes.

**`sync_changes` carries a denormalized `districtId`.** The feed filter cannot read it out of `data`,
because a DELETE entry has `data: null`. So `append()` denormalizes `districtId` onto the change document
itself:

- `user` / `incident` → the doc's `districtId`.
- **DELETE** → the full document is unavailable on a delete change event, so inherit the `districtId`
  from the most recent prior `sync_changes` entry for the same `mongoId` (the append-only log always has
  one, because the record must have been created/updated through the feed first). If none is found, the
  entry is recorded with `districtId: null` and is visible **only** to `superAdmin` (fail-closed).
- `district` → the district's own `_id`.

Index `sync_changes` on `{ index, districtId }` to back the scoped scan.

**`GET /changes`** adds `districtId ∈ {caller's district}` (plus `null`-district entries only for
`superAdmin`) to the `index > since` filter. Districts themselves are **reference data**: all `district`
entries are sent to every caller regardless of scope, because the client needs names for rendering and
they carry no PII (`name`, `geoJson`, `startingPoints`) — flagged deliberately, tighten later if desired.

**`POST /ingest`** authz-checks every event before applying: the payload's `districtId` (or, for an
UPDATE/DELETE, the **server** doc's current `districtId`) must match the caller's district. A mismatch is
**rejected**, not quarantined — it is an authorization failure, not a data conflict, so it must never
appear in the conflict queue. Report it in a `rejected[]` array on `IngestResultDto` (alongside
`applied[]` / `conflicts[]`) so the client can surface and drop the row rather than retry forever.

**Consequences.** The H2 client holds only its district's users + incidents, so locally-computed
statistics (§9.5) are district statistics — matching what that admin sees in the web app. `mine=true` on
`/conflicts` still filters by `originInstanceId`; district scoping applies on top.

---

## 6. Conflict model

### 6.1 Deduplication on first INSERT (business key)

On an INSERT with `mongoId = null`, the server looks up an existing doc by the entity's **business key**
before inserting:

- **`user`** → key = `email` (backed by a unique index; an E11000 race funnels to the same path). A
  match is **not** duplicated — it is raised as a `duplicate` **conflict** linking the H2 row to the
  existing `_id`, and that `_id` is returned so the two rows converge.
- **`incident`** → **no natural business key**; cross-side dedup is out of scope (two independent reports
  can legitimately coexist). Always inserts.

An INSERT retry carrying a known `mongoId` is an idempotent upsert by `_id`.

### 6.2 Optimistic concurrency on UPDATE / DELETE (`baseUpdatedAt`)

The client sends the `updatedAt` it last synced as `baseUpdatedAt`. If the current server doc's
`updatedAt` differs, the server changed underneath the client → the event is **quarantined** in
`sync_conflicts` (nothing silently overwritten). The conflict records the raising instance
(`originInstanceId`, from `X-Sync-Instance`) so the operator who caused it can find it (§6.5). The event
is still **acked** with a `conflictId` (so `/ingest` reports it via `conflicts[]`), but — unlike an
applied event — the client **keeps** the pending row (§6.5). Special cases: UPDATE of a remotely-deleted
doc → recreate (last-write-wins, nothing to conflict against); DELETE-vs-edit → quarantine the delete
intent. A record with a **pending** conflict **holds** further ingests (refreshes the captured local
snapshot, no new conflict row).

### 6.3 Resolution

The operator resolves via `POST /conflicts/:id/resolve` (from the desktop UI, §6.5):

- `local` → apply the client's captured snapshot (allowlisted upsert).
- `server` → keep the server doc; `touch` it to re-propagate to all instances.
- `merged` → apply the operator-supplied `data` (required — the field-level merge from the UI).

Resolution records `resolvedBy` (`req.user.sub`), `resolvedAt`, `resolution`, and marks the conflict
resolved. The resulting write flows back out through the watcher → `sync_changes` → all instances.

> **Resolution writes clear `_sync` (they are not stamped with an instance id).** All three paths
> (`local`, `server`/`touch`, `merged`) persist the doc with `_sync` cleared, so the change is published
> as `origin:"api"` with no `originInstanceId`. This is required: if a resolution carried the raising
> instance's id, `excludeInstance` (§7) would hide the resolved state from **exactly the instance that
> needs it** to reconcile and clear its pending row (§6.5). Clearing it makes the resolution visible to
> every instance including the originator.
> Double-resolution is guarded (resolving an already-resolved conflict is a no-op / `400`), so it is safe
> even though only the raising operator normally sees it.

### 6.4 Reference table

| Direction  | Operation                  | Behaviour                                                                                   |
| ---------- | -------------------------- | ------------------------------------------------------------------------------------------- |
| H2 → Mongo | INSERT (mongoId null)      | dedup by business key → insert **or** `duplicate` conflict; returns `mongoId` + `updatedAt` |
| H2 → Mongo | INSERT retry (mongoId set) | idempotent upsert by `_id`                                                                  |
| H2 → Mongo | UPDATE (base matches)      | allowlisted `$set` by `_id`; returns new `updatedAt`                                        |
| H2 → Mongo | UPDATE (base stale)        | **quarantine** (`update` conflict); acked, not applied                                      |
| H2 → Mongo | UPDATE (doc missing)       | recreate (last-write-wins)                                                                  |
| H2 → Mongo | DELETE (base matches)      | delete by `_id`                                                                             |
| H2 → Mongo | DELETE (base stale)        | **quarantine** (delete-vs-edit); acked, not applied                                         |
| Mongo → H2 | INSERT/UPDATE              | client upserts by `mongo_id`; sets `base_updated_at` from `data.updatedAt`                  |
| Mongo → H2 | DELETE                     | client deletes by `mongo_id`; ignore if absent                                              |

### 6.5 Desktop conflict UI (the only resolution surface)

Conflicts are surfaced and resolved **inside the JavaFX app** — there is no admin-front screen. Port the
reference branch's `ConflictController` + `conflicts.fxml` + `ConflictService` (field-level merge) onto
`origin/main` and point them at the api.

- **Discovery.** When `push()` gets a `conflicts[]` entry back, the client marks that record and raises a
  badge/panel. The panel loads `GET /conflicts?mine=true` — the operator sees **the conflicts their own
  instance raised**, with `localData` (what they edited offline) beside the redacted `serverData`.
- **Resolve.** The operator picks `local` / `server` / `merged` (the merge editor produces `data`) →
  `POST /conflicts/:id/resolve`.
- **Pending-row lifecycle.** The client keeps the `pending_changes` row while the conflict is unresolved
  (so the local edit is never lost and the badge persists). After resolution, the resolved server state
  arrives on the next `GET /changes` pull; the client applies it (upsert by `mongo_id`, refresh
  `base_updated_at`) and **clears the pending row** for that record. No re-push of the stale local edit.
- **Orphaned conflicts.** Because resolution is desktop-only and scoped to the raising instance, a
  conflict raised by an instance that never comes back online is **never resolved** — the server value
  simply stands, and it blocks only that one record's offline edit (never other records or other
  instances). `superAdmin` can use `GET /conflicts?mine=false` from a desktop app as the escape hatch.
  Note: this is the trade-off of dropping the admin-front surface.

---

## 7. Change-Streams watcher

`apps/api/src/watcher/change-stream.watcher.ts` runs a single `db.watch(SYNCED_COLLECTIONS,
{ fullDocument:"updateLookup", resumeAfter })`. One ordered stream ⇒ `sync_changes` indices stay
monotonic. Per event it maps the op type (`insert|replace`→INSERT, `update`→UPDATE, `delete`→DELETE),
reads `_sync.origin/instanceId` off the full document, and appends a redacted entry to `sync_changes`.
The resume token is persisted to `sync_state` after each processed event; on `ChangeStreamHistoryLost` it
reopens without a token and logs the gap loudly.

**Lifecycle** — started inside the api's existing boot block after `initContainer` and after
`httpServer.listen` (mirrors the Socket.IO precedent); `await seedExistingDocs(db)` runs first, then
`startWatcher(db)`. `stopWatcher()` is added to the graceful-shutdown `cleanup`.

**Requires a replica set** (§10) — `db.watch()` throws on a standalone mongod.

### Echo-skip & why the ack matters

The watcher records **every** change, including sync-origin ones. A polling instance skips its **own**
writes via `excludeInstance` (`originInstanceId: { $ne }`). Because the client already learned its new
`updatedAt` from the `/ingest` ack (§4.1), it never needs to see its own echo — so skipping it also
prevents a just-pushed local edit from being clobbered by a stale echo, and avoids a redundant re-apply.
The client still advances its cursor to the max `index` it receives.

---

## 8. ID strategy

- **MongoDB**: `users` / `incidents` use a **string UUID `_id`** (`randomUUID()`) — matching the api's
  existing convention (`@repo/shared` `toEntity`/`toDoc` map `_id ↔ id`). **Not** ObjectId.
- **H2**: every synced table carries `mongo_id VARCHAR(36) UNIQUE`, `NULL` until the server assigns it and
  the ack returns it.

---

## 9. Client design (JavaFX, onto `origin/main`)

**Reuses** (not reinvented): `auth/SsoAuthService`, `config/SessionConfig`, `repository/ApiException`,
`SyncStatus.AUTH_REQUIRED`, `AppContext::supplyAccessToken`, `MainApp` login wiring, `DatabaseManager`.

### 9.1 Keyed pending-changes table (replaces append-OUTBOX + `compact()`)

One row **per dirty record** — the table _is_ the compacted state, so the old client-side `compact()`
pass is deleted.

```sql
CREATE TABLE pending_changes (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity          VARCHAR(64)  NOT NULL,
  record_id       VARCHAR(36)  NOT NULL,
  operation       VARCHAR(8)   NOT NULL,      -- INSERT | UPDATE | DELETE
  mongo_id        VARCHAR(36),
  payload         CLOB,                       -- JSON snapshot; NULL for DELETE
  base_updated_at VARCHAR(40),
  occurred_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_pending UNIQUE (entity, record_id)
);
```

Plus migrations on the synced tables: `mongo_id VARCHAR(36) UNIQUE`, `base_updated_at VARCHAR(40)` (the
existing `synced` boolean stays for local bookkeeping).

`PendingChangesRepository`:

- `upsert(entity, recordId, op, mongoId, payload, baseUpdatedAt)` → `MERGE … KEY(entity, record_id)`,
  bumping `occurred_at`. Inline collapse (the only surviving bit of `compact()`): an existing unsynced
  `INSERT` + a new `UPDATE` stays `INSERT` with the new payload; an `INSERT` + `DELETE` while still
  unsynced deletes the row (created-then-deleted-offline cancels).
- `findBatch(limit)` → `ORDER BY occurred_at, id` (already one row per record).
- `setRecordMongoId(entity, recordId, mongoId)` → writes `mongo_id` (+`synced=TRUE`) to the entity row and the pending row.
- `advanceBaseAndClear(entity, recordId, mongoId, updatedAt, sentOccurredAt)` → set the entity's
  `base_updated_at`, then `DELETE FROM pending_changes WHERE … AND occurred_at <= sentOccurredAt` (the
  guard leaves a row re-dirtied mid-flight intact).

Local UI writes in `UserRepository` / `IncidentRepository` call `pending.upsert(...)`.

### 9.2 `SyncService` rewrite

- **Scheduler:** single-thread `ScheduledExecutorService` (`scheduleWithFixedDelay(cycle, 0, 30s)`;
  `stop()` → `shutdownNow()`) + `AtomicBoolean running` guarded by `compareAndSet(false, true)` — closes
  the old `Timer`/`volatile boolean` check-then-set window where `syncNow()` and a tick could both run.
  `syncNow()` → `executor.execute(cycle)` (no raw `Thread`).
- **push():** `findBatch(100)` → `POST /ingest` (no compaction). Per applied event: `setRecordMongoId`
  (if new) + `advanceBaseAndClear(...)` — advances `base_updated_at` **from the ack**. Per conflict:
  leave the pending row and surface to the conflict UI.
- **pull():** `GET /changes?since=cursor&limit=200` with `X-Sync-Instance`; dispatch by `entity` —
  `user`/`incident` upsert into their tables, `district` upserts into the H2 `districts` table
  (server→client only; the client never pushes districts). Set `base_updated_at` from `data.updatedAt`;
  advance the cursor. No bootstrap (`since=0` is the snapshot).
- **Auth handling:** `catch TokenUnavailableException → AUTH_REQUIRED`; `catch ApiException` where
  `getStatusCode()==401 → AUTH_REQUIRED` (else `ERROR`). An `AUTH_REQUIRED` listener triggers
  `loginViaBrowser()`; the scheduler keeps ticking and resumes on the next cycle.

### 9.3 HTTP client, config, DTOs

- `repository/SyncApiClient` (targets the **api** on `ApiConfig` :3000; SSO bearer on **all** calls; sends
  `X-Sync-Instance`; throws `ApiException` on non-2xx).
- `config/SyncConfig` trimmed to `instanceId` (a persisted per-install UUID) + `cursor` — drops
  `baseUrl` / `sharedSecret` / `bootstrapped`.
- `sync/*` DTOs: `IngestEvent`, `IngestResult` (`applied[]` + `conflicts[]`), `ChangeEntry`, `Conflict`,
  `ResolveConflictRequest`.

### 9.4 Conflict UI (desktop-only resolution)

Port the reference branch's `service/ConflictService`, `controller/ConflictController`, and
`fxml/conflicts.fxml` (field-level merge) onto `origin/main`, wired to `SyncApiClient`:

- `ConflictService` → `GET /conflicts?mine=true`, `POST /conflicts/:id/resolve`.
- `SyncService` surfaces a badge/count when `push()` returns `conflicts[]`; opening the panel loads the
  operator's own pending conflicts (§6.5).
- On resolve, do **not** clear the pending row directly — let the next `pull()` bring the resolved server
  state down and clear it (§6.5 pending-row lifecycle), so there is a single code path that reconciles H2.

This is the **only** conflict surface — no admin-front screen is built.

### 9.5 Districts & statistics (derived from synced data)

- **Districts** are a one-way synced entity (§5.3): `applyDistrictChange` upserts them into the H2
  `districts` table by `mongo_id`, and `DistrictRepository` gains `saveFromSync`/`updateFromSync`/
  `deleteFromSync`/`findByMongoId`. The incident-form district dropdown and readable-name lookup read from
  **local H2**, not a live `/districts` fetch — so they work offline.
- **Statistics** are **computed locally**. Because all incidents (+users) now sync into H2, the dashboard
  stat cards / `StatisticsController` derive their values from the local tables rather than a server
  aggregation call. This is offline-first and always consistent with what the operator sees; the old
  direct-api stats fetch is dropped.

Change Streams **require** a replica set; dev Mongo is currently a standalone `mongo:8`. In both
`docker-compose.yml` and `docker-compose.deploy.yml`:

- `mongodb`: `command: ["--replSet","rs0","--bind_ip_all"]`.
- Add an idempotent one-shot `mongo-init` sidecar (`restart:"no"`): if `rs.status().ok` then exit, else
  `rs.initiate({ _id:"rs0", members:[{ _id:0, host:"mongodb:27017" }] })`.
- Append `?replicaSet=rs0` to every **in-container** `MONGODB_URL` (api, auth-service, seeds; deploy keeps
  its SOPS-provided creds).
- Make dependents wait on `mongo-init` (`service_completed_successfully`).

A single-member RS with root auth needs **no keyfile**. This also unlocks the api's multi-document
transactions. (A future multi-member set would require a keyfile / x.509.)

---

## 11. Decisions & known follow-ups

> ### Decision D1 — feed scope: **DISTRICT-SCOPED** (resolved)
>
> `/changes` and `/ingest` are scoped to the caller's district for non-`superAdmin` callers; `superAdmin`
> sees everything. See §5.5 for the mechanics.
>
> **Why:** PR #151 (_"scope incidents to their reporter and close the surrounding IDOR class"_) forces
> `reporterId = req.user.sub` for non-admins on the incident list + stats routes and adds
> `resolveCallerListDistrict` / `callerCanReadDistrict` so a resident can neither pass an arbitrary
> `districtId` nor omit it for an unfiltered global list. The api's posture is now explicitly **no caller
> gets an unscoped global list**. A global sync feed handing every user + incident to any `admin` would
> reopen exactly that class through a different door — a district admin would replicate every district.
> District scoping keeps the sync surface consistent with the interactive routes it shadows.

> ### Decision D2 — unattended auth — see §3 _(provisional: accept interactive browser re-login)_

**Deferred (not in the first cut):**

- **Feed retention** — `sync_changes` is append-only and grows unbounded. Follow-up: TTL / snapshot
  compaction + a floor cursor with "client fell below the floor → re-bootstrap."
- **Sync side-effects** — the sync writer writes Mongo directly, bypassing the api's incident use-cases,
  so the **Neo4j graph projection** (`syncGraph`) and socket emits do **not** fire for sync-applied
  writes. Recommendation: fire the graph projection after a successful apply (else recommendations drift);
  drive live-UI socket refresh off the **watcher** (single choke point), not the writer. Both flaggable.
- **`_sync` schema modeling** — add it as an optional internal field on the shared doc schemas (§5.4);
  confirm no `.strict()` on the write path rejects it.

---

## 12. Verification (for the implementation phase)

1. `docker compose up -d mongodb mongo-init`; `mongosh --eval "rs.status().ok"` → `1`.
2. Bring up api + auth-service; logs: `initContainer → seedExistingDocs(N) → startWatcher (stream open) →
listen`; `/readyz` → 200.
3. Admin JWT → `GET /changes?since=0&limit=500` = full users+incidents snapshot with
   `passwordHash` / `totpSecret` / `lastTotpStep` / `_sync` **absent** (redaction).
4. `POST /ingest` INSERT (`X-Sync-Instance: it-1`) → `applied:[{ …, operation:"INSERT", updatedAt }]`;
   Mongo doc has `_sync.origin:"sync"`, `instanceId:"it-1"`.
5. Echo-skip: `GET /changes` **with** `X-Sync-Instance: it-1` omits the insert; a different instance sees it.
6. Conflict: UPDATE with a stale `baseUpdatedAt` → `conflicts[…]`, no write; `GET /conflicts` shows it; a
   second stale ingest for that record is **held** (no new conflict; `localData` refreshed).
7. Resolve `server` / `local` / `merged` → 200; the watcher re-emits; another instance sees it.
8. Driven client: log in (admin), edit offline → one `pending_changes` row per record; reconnect → push,
   ack advances `base_updated_at`, row cleared; a 2nd instance sees it via `/changes`; force token expiry
   → `AUTH_REQUIRED` → re-login → resume; two rapid `syncNow()` → `compareAndSet` blocks the concurrent cycle.
9. `apps/api` typecheck/tests + client `SyncServiceTest`.

---

## 13. Reference implementations (read-only, stale branches)

- Server logic — `Web-Apps-sync-gateway` @ `feat/sync-gateway`, `apps/sync-gateway/**`. Its
  `mongodb.connector.ts` / `shutdown.ts` / `load-env.ts` / `container.ts` are **obsolete** — use the api's
  `@repo/shared` infra instead.
- Client logic — `Client-Java` @ `feat/sync-gateway-flow` (`SyncService`, `OutboxRepository`,
  `SyncGatewayClient`, `sync/*`).
