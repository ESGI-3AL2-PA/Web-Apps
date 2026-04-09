import { z } from "../zod";

export const IncidentStatusSchema = z.enum(["reported", "assigned", "in_progress", "resolved", "rejected", "closed"]);
export type IncidentStatus = z.infer<typeof IncidentStatusSchema>;

export const IncidentHistoryItemSchema = z
    .object({
        status: IncidentStatusSchema.openapi({ description: "Incident status at this stage" }),
        note: z.string().optional().openapi({ description: "Optional note about the status change" }),
        changedBy: z.string().optional().openapi({ description: "ID of the user who changed the incident" }),
        changedAt: z.string().datetime().openapi({ description: "Timestamp of the status change" }),
    })
    .openapi({ title: "IncidentHistoryItem" });
export type IncidentHistoryItem = z.infer<typeof IncidentHistoryItemSchema>;

export const IncidentResponseDtoSchema = z
    .object({
        id: z.string().openapi({ description: "Unique incident identifier" }),
        reporterId: z.string().openapi({ description: "ID of the user who reported the incident" }),
        districtId: z.string().openapi({ description: "ID of the district where the incident was reported" }),
        category: z.string().openapi({ description: "Incident category", example: "road_damage" }),
        description: z.string().openapi({ description: "Detailed description of the incident" }),
        photoUrl: z.string().optional().openapi({ description: "Photo URL attached to the incident" }),
        status: IncidentStatusSchema.openapi({ description: "Current incident status" }),
        history: z.array(IncidentHistoryItemSchema).openapi({ description: "Incident status history" }),
        assignedTo: z.string().optional().openapi({ description: "ID of the user assigned to handle the incident" }),
        createdAt: z.string().datetime().openapi({ description: "Creation timestamp" }),
        updatedAt: z.string().datetime().openapi({ description: "Last update timestamp" }),
    })
    .openapi({ title: "IncidentResponse" });
export type IncidentResponseDto = z.infer<typeof IncidentResponseDtoSchema>;

export const CreateIncidentDtoSchema = z
    .object({
        districtId: z.string().openapi({ description: "ID of the district where the incident was reported" }),
        category: z.string().min(1).max(100).openapi({ description: "Incident category", example: "road_damage" }),
        description: z.string().min(1).openapi({ description: "Detailed description of the incident" }),
        photoUrl: z.string().url().optional().openapi({ description: "Optional photo URL attached to the incident" }),
        assignedTo: z.string().optional().openapi({ description: "ID of the user assigned to handle the incident" }),
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
    })
    .openapi({ title: "UpdateIncident" });
export type UpdateIncidentDto = z.infer<typeof UpdateIncidentDtoSchema>;

export const IncidentParamsDtoSchema = z.object({ id: z.string() }).openapi({ title: "IncidentParams" });
export type IncidentParamsDto = z.infer<typeof IncidentParamsDtoSchema>;

export const IncidentQueryDtoSchema = z
    .object({
        page: z.coerce.number().int().min(1).optional().default(1),
        limit: z.coerce.number().int().min(1).max(100).optional().default(20),
        search: z.string().optional(),
        category: z.string().optional(),
        status: IncidentStatusSchema.optional(),
        districtId: z.string().optional(),
        reporterId: z.string().optional(),
        assignedTo: z.string().optional(),
    })
    .openapi({ title: "IncidentQuery" });
export type IncidentQueryDto = z.infer<typeof IncidentQueryDtoSchema>;

