/**
 * Parser for the NDJSON seed scenario files under `apps/api/seed-data/*.txt`.
 *
 * Line grammar, evaluated top to bottom:
 *   - blank / whitespace-only  → ignored
 *   - `#…`                     → comment, ignored
 *   - `@collection <name>`     → subsequent documents go to that Mongo collection
 *   - `@graph <target>`        → subsequent documents go to a Neo4j-only dataset
 *   - anything else            → one JSON document appended to the active target
 *
 * Values that can only be known at run time are written as whole-string tokens
 * (`{{now}}`, `{{now-7d}}`, `{{passwordHash}}`) and resolved against a
 * `TokenContext` built by the caller.
 */

import { readFile } from "node:fs/promises";

/**
 * The allow-list *and* the insertion order. The ordering encodes the referential
 * dependencies (districts before users before listings/events/…), so documents are
 * always inserted in this sequence regardless of how the file groups its directives.
 */
export const MONGO_COLLECTIONS = [
  "districts",
  "users",
  "district_admins",
  "tags",
  "listings",
  "events",
  "incidents",
  "votes",
  "vote_responses",
  "conversations",
  "messages",
  "notifications",
  "transactions",
] as const;

export type MongoCollectionName = (typeof MONGO_COLLECTIONS)[number];

/**
 * The offline-sync feed: the change log, the watcher's cursor + one-shot `seeded`
 * flag, and the sequence counter keeping change indices monotonic. The seed drops
 * these together with the data they mirror — clearing the log while keeping the
 * counter would leave clients that already saw seq N silently missing the backfill.
 */
export const SYNC_COLLECTIONS = ["sync_changes", "sync_state", "counters"] as const;

/**
 * Everything the seed script drops before reinserting. Deliberately excludes
 * `refresh_tokens`, `contracts`, `authorization_codes` and the migration state.
 */
export const DROPPED_COLLECTIONS = [...MONGO_COLLECTIONS, ...SYNC_COLLECTIONS] as const;

const GRAPH_TARGETS = ["interests", "event_tags"] as const;
type GraphTarget = (typeof GRAPH_TARGETS)[number];

export interface InterestRow {
  userId: string;
  eventId: string;
  score: number;
}

export interface EventTagRow {
  eventId: string;
  tags: string[];
}

export interface SeedDocument extends Record<string, unknown> {
  _id: string;
}

export interface SeedDataset {
  /** Keyed by collection name, ordered by `MONGO_COLLECTIONS`. */
  collections: Map<MongoCollectionName, SeedDocument[]>;
  graph: {
    interests: InterestRow[];
    eventTags: EventTagRow[];
  };
  totalDocuments: number;
}

export interface TokenContext {
  /** Captured once per run so every `{{now}}` in a file resolves identically. */
  now: Date;
  /** argon2 hash shared by the seeded demo users. */
  passwordHash: string;
}

export class SeedParseError extends Error {
  constructor(
    readonly file: string,
    readonly line: number,
    message: string,
  ) {
    super(`${file}:${line}: ${message}`);
    this.name = "SeedParseError";
  }
}

// ─── Token resolution ─────────────────────────────────────────────────────────

// Whole-string match only: a value is substituted iff the entire string is a
// token. No intra-string interpolation, so copy that happens to contain braces
// is never touched.
const TOKEN_RE = /^\{\{(.+)\}\}$/;
const NOW_RE = /^now(?:([+-])(\d+)([smhd]))?$/;

const UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

export const resolveToken = (token: string, ctx: TokenContext): string => {
  if (token === "passwordHash") return ctx.passwordHash;

  const nowMatch = NOW_RE.exec(token);
  if (nowMatch) {
    const [, sign, amount, unit] = nowMatch;
    if (!sign) return ctx.now.toISOString();
    const offset = Number(amount) * UNIT_MS[unit!]! * (sign === "-" ? -1 : 1);
    return new Date(ctx.now.getTime() + offset).toISOString();
  }

  // Passing an unknown token through would write the literal `{{nwo}}` into the
  // document and only surface much later, in the UI.
  throw new Error(`unknown token "{{${token}}}" (expected {{passwordHash}} or {{now±Nd}})`);
};

const resolveTokens = <T>(value: T, ctx: TokenContext): T => {
  if (typeof value === "string") {
    const match = TOKEN_RE.exec(value);
    return (match ? resolveToken(match[1]!, ctx) : value) as T;
  }
  if (Array.isArray(value)) return value.map((item) => resolveTokens(item, ctx)) as T;
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveTokens(v, ctx)])) as T;
  }
  return value;
};

// ─── Parsing ──────────────────────────────────────────────────────────────────

type Target = { kind: "collection"; name: MongoCollectionName } | { kind: "graph"; name: GraphTarget };

const isMongoCollection = (name: string): name is MongoCollectionName =>
  (MONGO_COLLECTIONS as readonly string[]).includes(name);

const isGraphTarget = (name: string): name is GraphTarget => (GRAPH_TARGETS as readonly string[]).includes(name);

const parseDirective = (line: string, file: string, lineNo: number): Target => {
  const match = /^@(\w+)\s+(\S+)$/.exec(line);
  if (!match) {
    throw new SeedParseError(
      file,
      lineNo,
      `malformed directive "${line}" (expected "@collection <name>" or "@graph <name>")`,
    );
  }
  const [, verb, name] = match;

  if (verb === "collection") {
    if (!isMongoCollection(name!)) {
      throw new SeedParseError(file, lineNo, `unknown collection "${name}" (valid: ${MONGO_COLLECTIONS.join(", ")})`);
    }
    return { kind: "collection", name: name };
  }
  if (verb === "graph") {
    if (!isGraphTarget(name!)) {
      throw new SeedParseError(file, lineNo, `unknown graph target "${name}" (valid: ${GRAPH_TARGETS.join(", ")})`);
    }
    return { kind: "graph", name: name };
  }
  throw new SeedParseError(file, lineNo, `unknown directive "@${verb}" (expected @collection or @graph)`);
};

const asInterestRow = (doc: Record<string, unknown>, file: string, lineNo: number): InterestRow => {
  const { userId, eventId, score } = doc;
  if (typeof userId !== "string" || typeof eventId !== "string" || typeof score !== "number") {
    throw new SeedParseError(file, lineNo, "interest row requires string userId, string eventId and numeric score");
  }
  return { userId, eventId, score };
};

const asEventTagRow = (doc: Record<string, unknown>, file: string, lineNo: number): EventTagRow => {
  const { eventId, tags } = doc;
  if (typeof eventId !== "string" || !Array.isArray(tags) || tags.some((t) => typeof t !== "string")) {
    throw new SeedParseError(file, lineNo, "event_tags row requires a string eventId and a string[] tags");
  }
  return { eventId, tags: tags as string[] };
};

/** Pure and synchronous — the argon2 hash is awaited by the caller into `ctx`. */
export const parseSeedData = (text: string, ctx: TokenContext, file: string): SeedDataset => {
  const collections = new Map<MongoCollectionName, SeedDocument[]>();
  const interests: InterestRow[] = [];
  const eventTags: EventTagRow[] = [];
  const seenIds = new Map<string, number>();

  let target: Target | null = null;

  const lines = text.split("\n");
  for (const [index, raw] of lines.entries()) {
    const lineNo = index + 1;
    const line = raw.trim();

    if (line === "" || line.startsWith("#")) continue;

    if (line.startsWith("@")) {
      target = parseDirective(line, file, lineNo);
      continue;
    }

    if (!target) {
      throw new SeedParseError(file, lineNo, "document appears before any @collection or @graph directive");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (err) {
      throw new SeedParseError(file, lineNo, `invalid JSON — ${(err as Error).message}`);
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new SeedParseError(file, lineNo, "each document line must be a JSON object");
    }

    let doc: Record<string, unknown>;
    try {
      doc = resolveTokens(parsed as Record<string, unknown>, ctx);
    } catch (err) {
      throw new SeedParseError(file, lineNo, (err as Error).message);
    }

    if (target.kind === "graph") {
      if (target.name === "interests") interests.push(asInterestRow(doc, file, lineNo));
      else eventTags.push(asEventTagRow(doc, file, lineNo));
      continue;
    }

    // Idempotency is keyed on `_id` (delete-then-insert), so a document without
    // one would be re-inserted on every run.
    if (typeof doc._id !== "string" || doc._id === "") {
      throw new SeedParseError(file, lineNo, "document is missing a non-empty string _id");
    }
    const previous = seenIds.get(doc._id);
    if (previous !== undefined) {
      throw new SeedParseError(file, lineNo, `duplicate _id "${doc._id}" (first seen on line ${previous})`);
    }
    seenIds.set(doc._id, lineNo);

    const bucket = collections.get(target.name);
    if (bucket) bucket.push(doc as SeedDocument);
    else collections.set(target.name, [doc as SeedDocument]);
  }

  // Rebuild in MONGO_COLLECTIONS order so callers can iterate the map directly.
  const ordered = new Map<MongoCollectionName, SeedDocument[]>();
  for (const name of MONGO_COLLECTIONS) {
    const docs = collections.get(name);
    if (docs) ordered.set(name, docs);
  }

  return {
    collections: ordered,
    graph: { interests, eventTags },
    totalDocuments: seenIds.size,
  };
};

export const loadSeedFile = async (filePath: string, ctx: TokenContext): Promise<SeedDataset> => {
  const text = await readFile(filePath, "utf8");
  return parseSeedData(text, ctx, filePath);
};
