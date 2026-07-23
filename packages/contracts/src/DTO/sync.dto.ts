// DTO (couche contracts) : schémas zod de la passerelle de synchronisation offline
// entre le client desktop JavaFX (base H2 locale) et Mongo. On y trouve l'ingestion
// d'un lot d'événements locaux (ingest), sa comptabilité de retour (applied / conflicts
// / rejected) et le flux de changements descendant (changes) que le client rejoue.
import { z } from "../zod";

/** Entités relayées entre la base H2 de l'app desktop et Mongo. */
export const SyncEntitySchema = z.enum(["user", "incident", "district"]);
export type SyncEntity = z.infer<typeof SyncEntitySchema>;

/** Nature de l'opération locale à répercuter côté serveur. */
export const SyncOperationSchema = z.enum(["INSERT", "UPDATE", "DELETE"]);
export type SyncOperation = z.infer<typeof SyncOperationSchema>;

/** En-tête d'identification propre à chaque installation, envoyé par le client desktop à chaque appel de sync. */
export const SyncInstanceHeaderSchema = z.object({
  "x-sync-instance": z.string().min(1).max(64).openapi({ description: "Desktop install UUID" }),
});

/** Un événement local soumis à l'ingestion : décrit une écriture (INSERT/UPDATE/DELETE) sur une entité, avec son instantané de données. */
export const IngestEventDtoSchema = z
  .object({
    id: z.number().int().openapi({ description: "The client's stable per-record correlation id" }),
    entity: SyncEntitySchema,
    operation: SyncOperationSchema,
    mongoId: z.string().nullable().openapi({ description: "Server id, null until the server assigns one" }),
    data: z.record(z.unknown()).nullable().openapi({ description: "Local snapshot of the record; null for DELETE" }),
    occurredAt: z.string().datetime(),
    // Jeton de concurrence optimiste : valeur d'updatedAt connue du client, comparée
    // côté serveur pour détecter un conflit (édition concurrente) sur UPDATE/DELETE.
    baseUpdatedAt: z
      .string()
      .datetime()
      .optional()
      .openapi({ description: "Optimistic-concurrency token for UPDATE/DELETE" }),
  })
  .openapi({ title: "IngestEvent" });
export type IngestEventDto = z.infer<typeof IngestEventDtoSchema>;

/** Taille maximale d'un lot d'ingestion (nombre d'événements par appel). */
export const INGEST_BATCH_MAX = 100;

/** Corps de la requête d'ingestion : un tableau d'événements borné à INGEST_BATCH_MAX. */
export const IngestBatchDtoSchema = z
  .array(IngestEventDtoSchema)
  .max(INGEST_BATCH_MAX)
  .openapi({ title: "IngestBatch" });
export type IngestBatchDto = z.infer<typeof IngestBatchDtoSchema>;

/** Accusé d'un événement appliqué avec succès : renvoie l'id serveur et la valeur d'updatedAt réellement persistée. */
export const AppliedEventDtoSchema = z
  .object({
    id: z.number().int(),
    mongoId: z.string(),
    operation: SyncOperationSchema,
    // La valeur exactement persistée : le client peut ainsi avancer son jeton de
    // concurrence optimiste directement depuis l'accusé, sans attendre l'écho de
    // sa propre modification dans le flux de changements.
    updatedAt: z.string().datetime().nullable().openapi({ description: "null for an applied DELETE" }),
  })
  .openapi({ title: "AppliedEvent" });
export type AppliedEventDto = z.infer<typeof AppliedEventDtoSchema>;

/** Événement en conflit : pointe vers l'enregistrement de conflit (conflictId) à résoudre côté desktop. */
export const ConflictedEventDtoSchema = z
  .object({
    id: z.number().int(),
    mongoId: z.string(),
    conflictId: z.string(),
  })
  .openapi({ title: "ConflictedEvent" });
export type ConflictedEventDto = z.infer<typeof ConflictedEventDtoSchema>;

/**
 * Refus qui ne pourront jamais aboutir à la réessai : le client abandonne la ligne
 * en attente plutôt que de boucler. `out-of-district` et `read-only-entity` sont des
 * échecs d'autorisation ; `unprocessable` désigne un événement structurellement
 * impossible (UPDATE/DELETE sans `mongoId`, ou tout ce que le serveur n'a pas pu
 * router vers un chemin d'écriture).
 */
export const IngestRejectionReasonSchema = z.enum(["out-of-district", "read-only-entity", "unprocessable"]);
export type IngestRejectionReason = z.infer<typeof IngestRejectionReasonSchema>;

/** Événement rejeté définitivement, avec le motif du refus. */
export const RejectedEventDtoSchema = z
  .object({
    id: z.number().int(),
    reason: IngestRejectionReasonSchema,
  })
  .openapi({ title: "RejectedEvent" });
export type RejectedEventDto = z.infer<typeof RejectedEventDtoSchema>;

/**
 * Comptabilité exhaustive : chaque id d'événement soumis apparaît dans exactement
 * l'un des trois tableaux — jamais zéro fois, jamais deux fois. Le client pilote le
 * cycle de vie de ses lignes en attente là-dessus (applied → purge + avance du jeton ;
 * conflicts → conserve ; rejected → abandonne) ; un événement non rapporté laisserait
 * donc sa ligne orpheline, réessayée à chaque cycle indéfiniment.
 */
export const IngestResultDtoSchema = z
  .object({
    applied: z.array(AppliedEventDtoSchema),
    conflicts: z.array(ConflictedEventDtoSchema),
    rejected: z.array(RejectedEventDtoSchema),
  })
  .openapi({ title: "IngestResult" });
export type IngestResultDto = z.infer<typeof IngestResultDtoSchema>;

/** Entrée du flux de changements descendant : une écriture serveur à rejouer localement, repérée par un curseur `index` monotone. */
export const ChangeEntryDtoSchema = z
  .object({
    index: z.number().int().openapi({ description: "Monotonic feed cursor" }),
    entity: SyncEntitySchema,
    operation: SyncOperationSchema,
    mongoId: z.string(),
    data: z.record(z.unknown()).nullable().openapi({ description: "Redacted server document; null for DELETE" }),
    occurredAt: z.string().datetime(),
  })
  .openapi({ title: "ChangeEntry" });
export type ChangeEntryDto = z.infer<typeof ChangeEntryDtoSchema>;

/** Nombre maximal d'entrées renvoyées par une lecture du flux de changements. */
export const CHANGES_LIMIT_MAX = 500;

/** Query du flux de changements : reprise depuis un curseur (`since`), pagination (`limit`) et exclusion de sa propre instance (`excludeInstance`). */
export const ChangesQueryDtoSchema = z
  .object({
    since: z.coerce
      .number()
      .int()
      .min(0)
      .optional()
      .default(0)
      .openapi({ description: "Last index processed; 0 is a full snapshot" }),
    limit: z.coerce.number().int().min(1).max(CHANGES_LIMIT_MAX).optional().default(100),
    excludeInstance: z
      .string()
      .optional()
      .openapi({ description: "Echo-skip; the router fills this from X-Sync-Instance" }),
  })
  .openapi({ title: "ChangesQuery" });
export type ChangesQueryDto = z.infer<typeof ChangesQueryDtoSchema>;
