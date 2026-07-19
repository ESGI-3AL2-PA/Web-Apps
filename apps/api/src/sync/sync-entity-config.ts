/**
 * Sync write-model, derived from the canonical schemas rather than re-declared.
 *
 * The old standalone gateway kept its own entity map, which drifted from the api's
 * view of `users` / `incidents`. Here `writableFields` is computed from
 * `@repo/shared`'s `userDocumentSchema` and the api's `IncidentSchema` minus a
 * SERVER_OWNED set, so a new shared field flows through automatically instead of
 * silently staying unsynced.
 */
import type { SyncEntity } from "@repo/contracts";
import { userDocumentSchema, USERS_COLLECTION } from "@repo/shared";
import { IncidentSchema } from "../entities/incident.entity.js";

/** Fields an untrusted H2 snapshot must never be able to set. */
const SERVER_OWNED = {
  user: [
    "id",
    "passwordHash",
    "role",
    "balance",
    "banned",
    "emailVerified",
    "totpSecret",
    "totpEnabled",
    "lang",
    "lastTotpStep",
    "_sync",
    "createdAt",
    "updatedAt",
  ],
  incident: ["id", "_sync", "createdAt", "updatedAt"],
} as const satisfies Record<string, readonly string[]>;

const writableFrom = (shape: Record<string, unknown>, serverOwned: readonly string[]): readonly string[] =>
  Object.keys(shape).filter((k) => !serverOwned.includes(k));

export interface SyncEntityConfig {
  collection: string;
  /** Allowlist applied to every H2-originated write. Empty for a read-only entity. */
  writableFields: readonly string[];
  /** Server-authoritative fields H2 never supplies, applied on INSERT only. */
  defaultsOnInsert: Record<string, unknown>;
  /** Field used to dedup a first INSERT that carries no `mongoId` (§6.1). */
  businessKey?: string;
  /** Document field holding the district, or `null` when the doc *is* the district. */
  districtField: string | null;
  /** `false` => server → client only; any ingest event for it is rejected. */
  ingestAllowed: boolean;
}

export const SYNC_ENTITIES: Record<SyncEntity, SyncEntityConfig> = {
  user: {
    collection: USERS_COLLECTION,
    writableFields: writableFrom(userDocumentSchema.shape, SERVER_OWNED.user),
    defaultsOnInsert: {
      // A user first seen from H2 cannot log in until provisioned via auth-service.
      passwordHash: "!sync-imported-no-login",
      role: "user",
      balance: 0,
      banned: false,
      emailVerified: false,
      totpSecret: null,
      totpEnabled: false,
    },
    businessKey: "email",
    districtField: "districtId",
    ingestAllowed: true,
  },
  incident: {
    collection: "incidents",
    writableFields: writableFrom(IncidentSchema.shape, SERVER_OWNED.incident),
    defaultsOnInsert: { status: "open", history: [] },
    // No natural business key — two independent reports can legitimately coexist.
    districtField: "districtId",
    ingestAllowed: true,
  },
  district: {
    collection: "districts",
    // Districts are managed on the web; the desktop only reads them (§5.3).
    writableFields: [],
    defaultsOnInsert: {},
    districtField: null,
    ingestAllowed: false,
  },
};

export const SYNCED_COLLECTIONS = Object.values(SYNC_ENTITIES).map((c) => c.collection);

const COLLECTION_TO_ENTITY = new Map<string, SyncEntity>(
  (Object.entries(SYNC_ENTITIES) as [SyncEntity, SyncEntityConfig][]).map(([entity, cfg]) => [cfg.collection, entity]),
);

export const entityForCollection = (collection: string): SyncEntity | undefined => COLLECTION_TO_ENTITY.get(collection);

/** Stripped from any document leaving the server (change feed + conflict payloads). */
export const REDACTED_FIELDS = ["passwordHash", "totpSecret", "lastTotpStep", "_sync"] as const;

type Doc = Record<string, unknown>;

/** Narrow an incoming H2 snapshot to the entity's allowlist. */
export const pickWritable = (entity: SyncEntity, data: Doc | null): Doc => {
  if (!data) return {};
  const allowed = SYNC_ENTITIES[entity].writableFields;
  const out: Doc = {};
  for (const key of allowed) {
    if (data[key] !== undefined) out[key] = data[key];
  }
  return out;
};

/** Drop server-only fields and map `_id` → `id` for the wire. */
export const redactServerDoc = (doc: Doc | null | undefined): Doc | null => {
  if (!doc) return null;
  const out: Doc = { ...doc };
  for (const field of REDACTED_FIELDS) delete out[field];
  if ("_id" in out) {
    out.id = out._id;
    delete out._id;
  }
  return out;
};

/**
 * The district a document belongs to, for feed scoping (§5.5). A district document
 * is its own scope; anything else carries a `districtField`.
 */
export const districtOf = (entity: SyncEntity, doc: Doc | null | undefined): string | null => {
  if (!doc) return null;
  const field = SYNC_ENTITIES[entity].districtField;
  if (field === null) {
    const own = doc._id ?? doc.id;
    return typeof own === "string" ? own : null;
  }
  const value = doc[field];
  return typeof value === "string" && value ? value : null;
};
