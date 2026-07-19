import { z } from "../zod";

/** Entities bridged between the desktop app's H2 database and Mongo. */
export const SyncEntitySchema = z.enum(["user", "incident", "district"]);
export type SyncEntity = z.infer<typeof SyncEntitySchema>;

export const SyncOperationSchema = z.enum(["INSERT", "UPDATE", "DELETE"]);
export type SyncOperation = z.infer<typeof SyncOperationSchema>;

/** Per-install identifier the desktop client sends on every sync call. */
export const SyncInstanceHeaderSchema = z.object({
  "x-sync-instance": z.string().min(1).max(64).openapi({ description: "Desktop install UUID" }),
});

export const IngestEventDtoSchema = z
  .object({
    id: z.number().int().openapi({ description: "The client's stable per-record correlation id" }),
    entity: SyncEntitySchema,
    operation: SyncOperationSchema,
    mongoId: z.string().nullable().openapi({ description: "Server id, null until the server assigns one" }),
    data: z.record(z.unknown()).nullable().openapi({ description: "Local snapshot of the record; null for DELETE" }),
    occurredAt: z.string().datetime(),
    baseUpdatedAt: z
      .string()
      .datetime()
      .optional()
      .openapi({ description: "Optimistic-concurrency token for UPDATE/DELETE" }),
  })
  .openapi({ title: "IngestEvent" });
export type IngestEventDto = z.infer<typeof IngestEventDtoSchema>;

export const INGEST_BATCH_MAX = 100;

export const IngestBatchDtoSchema = z
  .array(IngestEventDtoSchema)
  .max(INGEST_BATCH_MAX)
  .openapi({ title: "IngestBatch" });
export type IngestBatchDto = z.infer<typeof IngestBatchDtoSchema>;

export const AppliedEventDtoSchema = z
  .object({
    id: z.number().int(),
    mongoId: z.string(),
    operation: SyncOperationSchema,
    // The exact persisted value, so the client can advance its optimistic-concurrency
    // token straight from the ack instead of waiting for its own change-feed echo.
    updatedAt: z.string().datetime().nullable().openapi({ description: "null for an applied DELETE" }),
  })
  .openapi({ title: "AppliedEvent" });
export type AppliedEventDto = z.infer<typeof AppliedEventDtoSchema>;

export const ConflictedEventDtoSchema = z
  .object({
    id: z.number().int(),
    mongoId: z.string(),
    conflictId: z.string(),
  })
  .openapi({ title: "ConflictedEvent" });
export type ConflictedEventDto = z.infer<typeof ConflictedEventDtoSchema>;

/**
 * Refusals that can never succeed on retry, so the client drops the pending row
 * rather than looping. `out-of-district` and `read-only-entity` are authorization
 * failures; `unprocessable` is a structurally impossible event (an UPDATE/DELETE
 * with no `mongoId`, or anything the server could not route to a write path).
 */
export const IngestRejectionReasonSchema = z.enum(["out-of-district", "read-only-entity", "unprocessable"]);
export type IngestRejectionReason = z.infer<typeof IngestRejectionReasonSchema>;

export const RejectedEventDtoSchema = z
  .object({
    id: z.number().int(),
    reason: IngestRejectionReasonSchema,
  })
  .openapi({ title: "RejectedEvent" });
export type RejectedEventDto = z.infer<typeof RejectedEventDtoSchema>;

/**
 * Total accounting: every submitted event id appears in exactly one of the three
 * arrays — never zero, never twice. The client keys its pending-row lifecycle off
 * this (applied → clear + advance the token; conflicts → keep; rejected → drop), so
 * an unreported event would strand its row and be retried every cycle forever.
 */
export const IngestResultDtoSchema = z
  .object({
    applied: z.array(AppliedEventDtoSchema),
    conflicts: z.array(ConflictedEventDtoSchema),
    rejected: z.array(RejectedEventDtoSchema),
  })
  .openapi({ title: "IngestResult" });
export type IngestResultDto = z.infer<typeof IngestResultDtoSchema>;

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

export const CHANGES_LIMIT_MAX = 500;

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
