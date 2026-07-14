import { z } from "../zod";

export const IncidentStatusSchema = z.enum(["open", "in_progress", "resolved", "closed"]);
export type IncidentStatus = z.infer<typeof IncidentStatusSchema>;

export const IncidentHistoryEntrySchema = z
  .object({
    status: IncidentStatusSchema,
    note: z.string().optional(),
    updatedBy: z.string().openapi({ description: "ID of the user who updated the incident" }),
    updatedAt: z.string().datetime(),
  })
  .openapi({ title: "IncidentHistoryEntry" });
export type IncidentHistoryEntry = z.infer<typeof IncidentHistoryEntrySchema>;

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

export const CreateIncidentDtoSchema = z
  .object({
    districtId: z.string().openapi({ description: "ID of the district where the incident occurred" }),
    category: z.string().min(1).max(100).openapi({ description: "Incident category", example: "vandalism" }),
    description: z.string().min(1).openapi({ description: "Detailed description" }),
    photoUrl: z.string().url().optional().openapi({ description: "Optional photo URL" }),
  })
  .openapi({ title: "CreateIncident" });
export type CreateIncidentDto = z.infer<typeof CreateIncidentDtoSchema>;

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

export const IncidentParamsDtoSchema = z.object({ id: z.string() }).openapi({ title: "IncidentParams" });
export type IncidentParamsDto = z.infer<typeof IncidentParamsDtoSchema>;

export const IncidentQueryDtoSchema = z
  .object({
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

export const IncidentStatsQueryDtoSchema = z
  .object({
    districtId: z.string().optional().openapi({ description: "Scope the aggregates to a single district" }),
  })
  .openapi({ title: "IncidentStatsQuery" });
export type IncidentStatsQueryDto = z.infer<typeof IncidentStatsQueryDtoSchema>;

export const IncidentStatsDtoSchema = z
  .object({
    total: z.number().int(),
    byStatus: z.record(IncidentStatusSchema, z.number().int()),
    byCategory: z.record(z.string(), z.number().int()),
  })
  .openapi({ title: "IncidentStats" });
export type IncidentStatsDto = z.infer<typeof IncidentStatsDtoSchema>;
