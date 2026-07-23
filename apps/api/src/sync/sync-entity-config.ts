/**
 * Couche sync : modèle d'écriture, dérivé des schémas canoniques plutôt que redéclaré.
 *
 * L'ancienne passerelle autonome gardait sa propre carte d'entités, qui dérivait de la
 * vision de l'api sur `users` / `incidents`. Ici `writableFields` est calculé à partir
 * de `userDocumentSchema` (de `@repo/shared`) et de `IncidentSchema` (de l'api), moins un
 * ensemble SERVER_OWNED, de sorte qu'un nouveau champ partagé se propage automatiquement
 * au lieu de rester silencieusement non synchronisé.
 */
import type { SyncEntity } from "@repo/contracts";
import { userDocumentSchema, USERS_COLLECTION } from "@repo/shared";
import { IncidentSchema } from "../entities/incident.entity.js";

/** Champs qu'un snapshot H2 non fiable ne doit jamais pouvoir positionner. */
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

// Calcule les champs modifiables : toutes les clés du schéma moins l'ensemble server-owned.
const writableFrom = (shape: Record<string, unknown>, serverOwned: readonly string[]): readonly string[] =>
  Object.keys(shape).filter((k) => !serverOwned.includes(k));

/** Configuration de sync d'une entité : collection, champs modifiables, valeurs par défaut et scoping. */
export interface SyncEntityConfig {
  collection: string;
  /** Allowlist appliquée à chaque écriture d'origine H2. Vide pour une entité en lecture seule. */
  writableFields: readonly string[];
  /** Champs faisant autorité côté serveur, jamais fournis par H2, appliqués à l'INSERT seulement. */
  defaultsOnInsert: Record<string, unknown>;
  /** Champ servant à dédoublonner un premier INSERT sans `mongoId` (§6.1). */
  businessKey?: string;
  /** Champ du document portant le quartier, ou `null` quand le document *est* le quartier. */
  districtField: string | null;
  /** `false` => serveur → client uniquement ; tout événement d'ingestion pour elle est rejeté. */
  ingestAllowed: boolean;
}

export const SYNC_ENTITIES: Record<SyncEntity, SyncEntityConfig> = {
  user: {
    collection: USERS_COLLECTION,
    writableFields: writableFrom(userDocumentSchema.shape, SERVER_OWNED.user),
    defaultsOnInsert: {
      // Un utilisateur vu pour la première fois depuis H2 ne peut pas se connecter tant
      // qu'il n'est pas provisionné via l'auth-service.
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
    // Pas de clé métier naturelle — deux signalements indépendants peuvent légitimement coexister.
    districtField: "districtId",
    ingestAllowed: true,
  },
  district: {
    collection: "districts",
    // Les quartiers sont gérés sur le web ; le desktop se contente de les lire (§5.3).
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

/** Résout l'entité de sync correspondant à un nom de collection Mongo. */
export const entityForCollection = (collection: string): SyncEntity | undefined => COLLECTION_TO_ENTITY.get(collection);

/** Retirés de tout document quittant le serveur (change feed + payloads de conflit). */
export const REDACTED_FIELDS = ["passwordHash", "totpSecret", "lastTotpStep", "_sync"] as const;

type Doc = Record<string, unknown>;

/** Restreint un snapshot H2 entrant à l'allowlist de l'entité. */
export const pickWritable = (entity: SyncEntity, data: Doc | null): Doc => {
  if (!data) return {};
  const allowed = SYNC_ENTITIES[entity].writableFields;
  const out: Doc = {};
  for (const key of allowed) {
    if (data[key] !== undefined) out[key] = data[key];
  }
  return out;
};

/** Retire les champs réservés au serveur et mappe `_id` → `id` pour la transmission. */
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
 * Le quartier auquel appartient un document, pour le scoping du flux (§5.5). Un document
 * de quartier est son propre scope ; tout le reste porte un `districtField`.
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
