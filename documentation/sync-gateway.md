# sync-gateway — H2 ↔ MongoDB Synchronisation

## Role

A dedicated `sync-gateway` service (`apps/sync-gateway`) bridges the Java app's embedded H2 database and MongoDB. It handles bidirectional sync:

- **H2 → MongoDB**: changes made in the Java app are reflected in MongoDB
- **MongoDB → H2**: changes made via the Node.js API are reflected in each Java app instance

sync-gateway is the single known endpoint — Java app instances always initiate communication.

---

## Architecture

> **Port TBD** — must be assigned before the service is added to `docker-compose.yml` and `turbo.json`. Other services: api 3000, admin-front 4000, user-front 5000, auth-service 6000.

```
Java instance 1 ──┐  POST /ingest          ┌── GET /changes?since=<cursor>
Java instance 2 ──┤──────────────────────▶ │ ◀──────────────────────────────┤ Java instance 2
Java instance N ──┘                        │                                 └── Java instance N
                                      sync-gateway
                                           │
                                    upsert / delete
                                           │
                                        MongoDB
                                   (sync_changes,
                                    + all synced collections)
```

Each Java instance:
1. Reads its local H2 outbox and **pushes** events to sync-gateway (`POST /ingest`)
2. **Polls** sync-gateway for outbound changes (`GET /changes`) and applies them to H2

- No extra infrastructure — HTTP only
- Java app outbox persists events locally; if sync-gateway is down, Java retries on next scheduler tick
- Each Java instance manages its own `cursor` for the `/changes` poll

---

## Outbox Contract (Java App)

### OUTBOX table schema (H2)

```sql
CREATE TABLE OUTBOX (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity      VARCHAR(64)   NOT NULL,
  operation   VARCHAR(8)    NOT NULL,  -- INSERT | UPDATE | DELETE
  mongo_id    VARCHAR(24),             -- NULL on INSERT until sync-gateway responds
  payload     CLOB          NOT NULL,  -- JSON snapshot of the row
  occurred_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at     TIMESTAMP                -- NULL until acknowledged by sync-gateway
);
```

Each synced entity table must also carry a `mongo_id VARCHAR(24) UNIQUE` column, `NULL` until sync-gateway assigns it.

### Event payload (JSON)

```json
{
  "id": 42,
  "entity": "user",
  "operation": "INSERT",
  "mongoId": null,
  "data": { "firstName": "Alice", "lastName": "Dupont", "email": "alice@example.com" },
  "occurredAt": "2026-04-04T10:00:00Z"
}
```

`data` is a **full document snapshot** for INSERT/UPDATE. For DELETE, `data` is `null`.

### Java scheduler behaviour

Each tick — **ingest before retrieving changes**:

1. Read unsent rows (`sent_at IS NULL`) ordered by `id ASC`, batch up to 100
2. `POST /ingest` — on `200 OK`, write returned `mongoId` values back to entity and OUTBOX rows, mark sent. On failure, retry next tick.
3. `GET /changes?since=<cursor>` — apply changes to H2, advance cursor

Ingest runs first so that if a newer MongoDB version exists, it arrives in step 3 and correctly overwrites the stale outbox entry.

---

## sync-gateway REST API

### `POST /ingest`

Receives a batch of outbox events and writes them to MongoDB.

**Request body:**
```json
[
  { "id": 42, "entity": "user",     "operation": "INSERT", "mongoId": null,                       "data": { ... }, "occurredAt": "..." },
  { "id": 21, "entity": "district", "operation": "UPDATE", "mongoId": "98078ad01245fe0581a02359", "data": { ... }, "occurredAt": "..." }
]
```

**Response:** `200 OK` — only INSERT events produce a response entry (UPDATE/DELETE don't need one, `mongoId` is already known).

```json
[{ "id": 42, "mongoId": "6610a2f3e4b0c12d3f456789" }]
```

Processing per event:
- `INSERT`: generate ObjectId, insert document with `_id = mongoId`, return `{ id, mongoId }`
- `UPDATE`: apply full `$set` where `_id = mongoId` (no response entry)
- `DELETE`: delete where `_id = mongoId` (no response entry)

On retry with a non-null `mongoId` on an INSERT: upsert using the existing `mongoId` instead of inserting.

Events with an unknown `entity` are logged and skipped.

> **Batch size**: enforce a request body size limit (e.g. 5 MB) to guard against large snapshots.

---

### `GET /changes?since=<cursor>&limit=<n>`

Returns MongoDB-originated changes for the Java app to apply to H2.

| Param | Type | Default | Description |
|---|---|---|---|
| `since` | integer | `0` | Last index processed by the caller |
| `limit` | integer | `100` | Max events to return |

**Response:**
```json
[
  { "index": 15, "entity": "user", "operation": "UPDATE", "mongoId": "6610a2f3e4b0c12d3f456789", "data": { ... }, "occurredAt": "..." }
]
```

---

## Sync Loop (Internal)

sync-gateway runs a background Change Streams watcher. On each MongoDB change event:
1. Skip if `origin == "sync"` (written by sync-gateway)
2. Write a new entry to `sync_changes` with an atomically incremented `index`

---

## MongoDB Collections

### `sync_changes`

```
SYNC_CHANGES {
  _id        ObjectId PK
  index      int
  entity     string
  operation  string    INSERT | UPDATE | DELETE
  mongoId    string    _id of the changed document
  data       object    current document snapshot
  occurredAt timestamp
}
```

---

## ID Strategy

- **H2**: every synced table has `mongo_id VARCHAR(24) UNIQUE`, `NULL` until assigned.
- **MongoDB**: documents use that ObjectId as `_id`.

| Direction | Operation | Behaviour |
|---|---|---|
| H2 → Mongo | INSERT | sync-gateway generates ObjectId, inserts doc, returns `mongoId` to Java |
| H2 → Mongo | INSERT retry (mongoId null) | business key unique index triggers dedup flow (see below) |
| H2 → Mongo | INSERT retry (mongoId set) | upsert using existing `mongoId` — safe |
| H2 → Mongo | UPDATE | full `$set` where `_id = mongoId`; if not found, log & skip (deleted remotely) |
| H2 → Mongo | UPDATE (stale) | last-write-wins — intentional; optimistic concurrency not in scope |
| H2 → Mongo | DELETE | delete where `_id = mongoId`; if not found, ignore and mark sent |
| Mongo → H2 | INSERT | Java inserts row with `mongo_id`; if `mongo_id` already exists, treat as already applied |
| Mongo → H2 | UPDATE | Java updates row by `mongo_id`; if not found, treat as INSERT |
| Mongo → H2 | DELETE | Java deletes row by `mongo_id`; if not found, ignore |

---

## Deduplication

**Problem**: the same entity can be created independently on both sides before a sync cycle — H2 with `mongo_id = NULL`, MongoDB via the Node.js API.

????
