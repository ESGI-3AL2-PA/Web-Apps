import { z } from "zod";

// Entité Notification : message adressé à un utilisateur, catégorisé par domaine et
// pointant éventuellement vers la ressource concernée pour la navigation.

// Domaine fonctionnel de la notification (piloté l'icône/le regroupement côté front).
export const NotificationTypeSchema = z.enum(["listing", "contract", "event", "message", "vote", "incident", "system"]);
export type NotificationType = z.infer<typeof NotificationTypeSchema>;

// Type de la ressource référencée par `refId` (deep-link vers l'objet à l'origine de la notif).
export const NotificationRefTypeSchema = z.enum([
  "listing",
  "contract",
  "event",
  "conversation",
  "message",
  "vote",
  "incident",
]);
export type NotificationRefType = z.infer<typeof NotificationRefTypeSchema>;

export const NotificationSchema = z.object({
  id: z.string(),
  recipientId: z.string(),
  districtId: z.string(),
  type: NotificationTypeSchema,
  title: z.string().min(1).max(200),
  message: z.string().min(1),
  // refId/refType vont de pair : id + type de la ressource pointée (deep-link). Optionnels pour les notifs system.
  refId: z.string().optional(),
  refType: NotificationRefTypeSchema.optional(),
  read: z.boolean(),
  createdAt: z.string().datetime(),
});

export type Notification = z.infer<typeof NotificationSchema>;
