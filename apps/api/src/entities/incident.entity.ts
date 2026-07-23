import { z } from "zod";
import { syncProvenanceSchema } from "@repo/shared";

// Entité Incident (signalement) : problème remonté par un habitant dans son quartier,
// suivi via un statut et un historique d'évolutions, éventuellement assigné à un référent.

// Statut du signalement (ouvert -> en cours -> résolu -> clôturé).
export const IncidentStatusSchema = z.enum(["open", "in_progress", "resolved", "closed"]);
export type IncidentStatus = z.infer<typeof IncidentStatusSchema>;

// Une entrée d'historique : le statut atteint, une note facultative, l'auteur et la date du changement.
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
  // Id du référent en charge du traitement ; absent tant qu'aucun n'est assigné.
  assignedTo: z.string().optional(),
  // Provenance interne de la synchro offline ; retirée par `toEntity` avant que le doc ne quitte le repository.
  _sync: syncProvenanceSchema.optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Incident = z.infer<typeof IncidentSchema>;
