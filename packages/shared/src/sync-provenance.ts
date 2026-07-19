import { z } from "zod";

/**
 * Provenance stamp written onto every document mutated by the offline-sync ingest
 * path. The Change-Streams watcher reads it back to tag feed entries with their
 * origin instance, which is what powers the client's echo-skip.
 *
 * Internal to the persistence layer: `toEntity` strips it, so it never reaches an
 * API response, a DTO, or the Neo4j projection.
 */
export const syncProvenanceSchema = z.object({
  origin: z.literal("sync"),
  occurredAt: z.string().datetime(),
  instanceId: z.string(),
});

export type SyncProvenance = z.infer<typeof syncProvenanceSchema>;
