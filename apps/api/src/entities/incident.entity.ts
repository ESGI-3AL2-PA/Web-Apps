import { z } from "zod";

export const IncidentStatusSchema = z.enum(["open", "in_progress", "resolved", "closed"]);
export type IncidentStatus = z.infer<typeof IncidentStatusSchema>;

export const IncidentHistoryEntrySchema = z.object({
  status: IncidentStatusSchema,
  note: z.string().optional(),
  updatedBy: z.string(),
  updatedAt: z.string().datetime(),
});
export type IncidentHistoryEntry = z.infer<typeof IncidentHistoryEntrySchema>;

export const IncidentSchema = z.object({
  id: z.string(),
  reporterId: z.string(),
  districtId: z.string(),
  category: z.string().min(1).max(100),
  description: z.string().min(1),
  photoUrl: z.string().optional(),
  status: IncidentStatusSchema,
  history: z.array(IncidentHistoryEntrySchema),
  assignedTo: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Incident = z.infer<typeof IncidentSchema>;
