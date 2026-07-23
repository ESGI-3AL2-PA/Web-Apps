import { z } from "../zod";

/**
 * DTO (schémas zod) du signalement (incident) de quartier.
 *
 * Un signalement est rattaché à un quartier, porte une catégorie, un statut de cycle de vie,
 * un historique de changements de statut et un éventuel affectataire (modérateur/admin).
 * Ce fichier couvre la réponse, l'entrée d'historique, la création/mise à jour, la requête
 * de listing et les agrégats statistiques (`IncidentStats`).
 */

// Cycle de vie d'un signalement : ouvert, en cours, résolu, clos.
export const IncidentStatusSchema = z.enum(["open", "in_progress", "resolved", "closed"]);
export type IncidentStatus = z.infer<typeof IncidentStatusSchema>;

// Une entrée de l'historique : le statut atteint, une note facultative, l'auteur et la date du changement.
export const IncidentHistoryEntrySchema = z
  .object({
    status: IncidentStatusSchema,
    note: z.string().optional(),
    updatedBy: z.string().openapi({ description: "ID of the user who updated the incident" }),
    updatedAt: z.string().datetime(),
  })
  .openapi({ title: "IncidentHistoryEntry" });
export type IncidentHistoryEntry = z.infer<typeof IncidentHistoryEntrySchema>;

// Forme de réponse d'un signalement renvoyée par l'API.
export const IncidentResponseDtoSchema = z
  .object({
    id: z.string().openapi({ description: "Unique incident identifier" }),
    reporterId: z.string().openapi({ description: "ID of the user who reported the incident" }),
    districtId: z.string().openapi({ description: "ID of the district where the incident occurred" }),
    category: z.string().openapi({ description: "Incident category", example: "vandalism" }),
    description: z.string().openapi({ description: "Detailed description of the incident" }),
    photoUrl: z.string().optional().openapi({ description: "Optional photo URL" }),
    status: IncidentStatusSchema.openapi({ description: "Current status" }),
    history: z.array(IncidentHistoryEntrySchema).openapi({ description: "Status change history" }),
    assignedTo: z.string().optional().openapi({ description: "ID of the moderator/admin handling it" }),
    createdAt: z.string().datetime().openapi({ description: "Creation timestamp" }),
    updatedAt: z.string().datetime().openapi({ description: "Last update timestamp" }),
  })
  .openapi({ title: "IncidentResponse" });
export type IncidentResponseDto = z.infer<typeof IncidentResponseDtoSchema>;

// Corps de création d'un signalement (statut, historique et affectataire dérivés côté serveur).
export const CreateIncidentDtoSchema = z
  .object({
    districtId: z.string().openapi({ description: "ID of the district where the incident occurred" }),
    category: z.string().min(1).max(100).openapi({ description: "Incident category", example: "vandalism" }),
    description: z.string().min(1).openapi({ description: "Detailed description" }),
    photoUrl: z.string().url().optional().openapi({ description: "Optional photo URL" }),
  })
  .openapi({ title: "CreateIncident" });
export type CreateIncidentDto = z.infer<typeof CreateIncidentDtoSchema>;

// Corps de mise à jour partielle : tous les champs facultatifs, statut et affectataire modifiables.
export const UpdateIncidentDtoSchema = z
  .object({
    category: z.string().min(1).max(100).optional(),
    description: z.string().min(1).optional(),
    photoUrl: z.string().url().optional(),
    status: IncidentStatusSchema.optional(),
    assignedTo: z.string().optional(),
    historyNote: z
      .string()
      .optional()
      .openapi({ description: "Optional note appended to the history when the status changes" }),
  })
  .openapi({ title: "UpdateIncident" });
export type UpdateIncidentDto = z.infer<typeof UpdateIncidentDtoSchema>;

// Paramètre d'URL : identifiant du signalement.
export const IncidentParamsDtoSchema = z.object({ id: z.string() }).openapi({ title: "IncidentParams" });
export type IncidentParamsDto = z.infer<typeof IncidentParamsDtoSchema>;

// Query string de listing paginé, avec filtres facultatifs (statut, catégorie, quartier, auteur, affectataire).
export const IncidentQueryDtoSchema = z
  .object({
    // Pagination : page >= 1, 20 par défaut, plafonnée à 100 par page.
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    search: z.string().max(200).optional(),
    status: IncidentStatusSchema.optional(),
    category: z.string().optional(),
    districtId: z.string().optional(),
    reporterId: z.string().optional(),
    assignedTo: z.string().optional(),
  })
  .openapi({ title: "IncidentQuery" });
export type IncidentQueryDto = z.infer<typeof IncidentQueryDtoSchema>;
export type IncidentQueryInput = z.input<typeof IncidentQueryDtoSchema>;

// Query string des statistiques : restreint éventuellement les agrégats à un seul quartier.
export const IncidentStatsQueryDtoSchema = z
  .object({
    districtId: z.string().optional().openapi({ description: "Scope the aggregates to a single district" }),
  })
  .openapi({ title: "IncidentStatsQuery" });
export type IncidentStatsQueryDto = z.infer<typeof IncidentStatsQueryDtoSchema>;

// Agrégats des signalements : total global et décomptes ventilés par statut et par catégorie.
export const IncidentStatsDtoSchema = z
  .object({
    total: z.number().int(),
    byStatus: z.record(IncidentStatusSchema, z.number().int()),
    byCategory: z.record(z.string(), z.number().int()),
  })
  .openapi({ title: "IncidentStats" });
export type IncidentStatsDto = z.infer<typeof IncidentStatsDtoSchema>;
