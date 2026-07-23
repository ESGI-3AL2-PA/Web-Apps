// Schéma zod partagé (couche « persistance / synchro offline »). Décrit le tampon
// de provenance interne aux documents.
import { z } from "zod";

/**
 * Tampon de provenance écrit sur chaque document muté par le chemin d'ingestion de
 * la synchro offline. Le watcher Change-Streams le relit pour étiqueter les entrées
 * de flux avec leur instance d'origine, ce qui alimente le « echo-skip » côté client
 * (ignorer l'écho de ses propres écritures).
 *
 * Interne à la couche de persistance : `toEntity` le retire, il n'atteint donc
 * jamais une réponse d'API, un DTO ni la projection Neo4j.
 */
export const syncProvenanceSchema = z.object({
  origin: z.literal("sync"),
  occurredAt: z.string().datetime(),
  instanceId: z.string(),
});

export type SyncProvenance = z.infer<typeof syncProvenanceSchema>;
