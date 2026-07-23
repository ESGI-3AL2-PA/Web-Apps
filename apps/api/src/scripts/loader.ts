/**
 * Parser des fichiers de scénario seed au format NDJSON, situés à la racine du repo
 * sous `seed-data/*.txt`.
 *
 * Grammaire ligne à ligne, évaluée de haut en bas :
 *   - vide / uniquement des espaces  → ignoré
 *   - `#…`                           → commentaire, ignoré
 *   - `@collection <name>`           → les documents suivants vont dans cette collection Mongo
 *   - `@graph <target>`              → les documents suivants vont dans un dataset Neo4j uniquement
 *   - autre                          → un document JSON ajouté à la cible active
 *
 * Les valeurs connues seulement à l'exécution sont écrites sous forme de tokens
 * occupant toute la chaîne (`{{now}}`, `{{now-7d}}`, `{{passwordHash}}`) et résolues
 * contre un `TokenContext` construit par l'appelant.
 */

import { readFile } from "node:fs/promises";

/**
 * À la fois la liste blanche *et* l'ordre d'insertion. L'ordre encode les
 * dépendances référentielles (quartiers avant users avant annonces/événements/…),
 * si bien que les documents sont toujours insérés dans cette séquence quelle que
 * soit la manière dont le fichier groupe ses directives.
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
 * Le flux de synchronisation offline : le journal des changements, le curseur du
 * watcher + son drapeau one-shot `seeded`, et le compteur de séquence qui garde les
 * indices de changement monotones. Le seed supprime ces collections en même temps
 * que les données qu'elles reflètent — vider le journal en conservant le compteur
 * laisserait les clients ayant déjà vu la séquence N silencieusement privés du backfill.
 */
export const SYNC_COLLECTIONS = ["sync_changes", "sync_state", "counters"] as const;

/**
 * Tout ce que le script de seed supprime avant de réinsérer. Exclut délibérément
 * `refresh_tokens`, `contracts`, `authorization_codes` et l'état des migrations.
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
  /** Indexé par nom de collection, ordonné selon `MONGO_COLLECTIONS`. */
  collections: Map<MongoCollectionName, SeedDocument[]>;
  graph: {
    interests: InterestRow[];
    eventTags: EventTagRow[];
  };
  totalDocuments: number;
}

export interface TokenContext {
  /** Capturé une fois par exécution pour que tous les `{{now}}` d'un fichier se résolvent à l'identique. */
  now: Date;
  /** Hash argon2 partagé par les users de démo injectés. */
  passwordHash: string;
}

/** Erreur de parsing localisée (fichier + numéro de ligne) pour un diagnostic précis. */
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

// ─── Résolution des tokens ────────────────────────────────────────────────────

// Correspondance sur la chaîne entière uniquement : une valeur n'est substituée
// que si toute la chaîne est un token. Pas d'interpolation intra-chaîne, donc un
// texte contenant des accolades n'est jamais touché.
const TOKEN_RE = /^\{\{(.+)\}\}$/;
// `now` seul, ou avec un décalage signé : now±N{s|m|h|d} (ex. now-7d, now+2h).
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

  // Laisser passer un token inconnu écrirait le littéral `{{nwo}}` dans le document
  // et ne se manifesterait que bien plus tard, dans l'UI. On échoue tôt.
  throw new Error(`unknown token "{{${token}}}" (expected {{passwordHash}} or {{now±Nd}})`);
};

// Parcourt récursivement une valeur JSON (chaîne / tableau / objet) et substitue
// chaque token qui occupe une chaîne entière.
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

// Cible active vers laquelle les documents qui suivent une directive sont dirigés.
type Target = { kind: "collection"; name: MongoCollectionName } | { kind: "graph"; name: GraphTarget };

const isMongoCollection = (name: string): name is MongoCollectionName =>
  (MONGO_COLLECTIONS as readonly string[]).includes(name);

const isGraphTarget = (name: string): name is GraphTarget => (GRAPH_TARGETS as readonly string[]).includes(name);

// Parse une ligne `@verbe nom` en cible typée, en validant le nom contre la liste
// blanche correspondante (collection Mongo ou target graphe).
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

/**
 * Parse le texte NDJSON complet en un `SeedDataset` prêt à insérer. Pure et
 * synchrone — le hash argon2 est déjà résolu dans `ctx` par l'appelant. Valide au
 * passage : JSON par ligne, `_id` non vide, unicité des `_id`, forme des lignes graphe.
 */
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

    // L'idempotence repose sur `_id` (suppression puis insertion) : un document
    // sans _id serait réinséré à chaque exécution.
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

  // Reconstruit dans l'ordre de MONGO_COLLECTIONS pour que l'appelant puisse
  // itérer la map directement (respect des dépendances référentielles).
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

/** Lit un fichier seed depuis le disque et le parse en `SeedDataset`. */
export const loadSeedFile = async (filePath: string, ctx: TokenContext): Promise<SeedDataset> => {
  const text = await readFile(filePath, "utf8");
  return parseSeedData(text, ctx, filePath);
};
