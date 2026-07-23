import { z } from "../zod";
import { BooleanQueryParamSchema } from "./query.dto";

/**
 * DTO (schémas zod) de la notification utilisateur.
 *
 * Une notification est destinée à un utilisateur d'un quartier, catégorisée par `type` et
 * pouvant pointer vers une ressource référencée (`refId` + `refType`). Ce fichier couvre la
 * réponse, la création, la requête de listing et la réponse au marquage global comme lu.
 */

// Catégorie de la notification (pilote l'icône/le libellé côté front).
export const NotificationTypeSchema = z.enum(["listing", "contract", "event", "message", "vote", "incident", "system"]);
export type NotificationType = z.infer<typeof NotificationTypeSchema>;

// Type de la ressource référencée par la notification (cible du lien « voir »).
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

// Forme de réponse d'une notification renvoyée par l'API.
export const NotificationResponseDtoSchema = z
  .object({
    id: z.string().openapi({ description: "Unique notification identifier" }),
    recipientId: z.string().openapi({ description: "ID of the user receiving the notification" }),
    districtId: z.string().openapi({ description: "ID of the district this notification belongs to" }),
    type: NotificationTypeSchema.openapi({ description: "Notification category" }),
    title: z.string().openapi({ description: "Title", example: "New message" }),
    message: z.string().openapi({ description: "Notification body" }),
    refId: z.string().optional().openapi({ description: "ID of the referenced resource" }),
    refType: NotificationRefTypeSchema.optional().openapi({ description: "Type of the referenced resource" }),
    read: z.boolean().openapi({ description: "Whether the notification has been read" }),
    createdAt: z.string().datetime(),
  })
  .openapi({ title: "NotificationResponse" });
export type NotificationResponseDto = z.infer<typeof NotificationResponseDtoSchema>;

// Corps de création d'une notification (le quartier et l'état lu/non lu sont gérés côté serveur).
export const CreateNotificationDtoSchema = z
  .object({
    recipientId: z.string(),
    type: NotificationTypeSchema,
    title: z.string().min(1).max(200),
    message: z.string().min(1),
    refId: z.string().optional(),
    refType: NotificationRefTypeSchema.optional(),
  })
  .openapi({ title: "CreateNotification" });
export type CreateNotificationDto = z.infer<typeof CreateNotificationDtoSchema>;

// Paramètre d'URL : identifiant de la notification.
export const NotificationParamsDtoSchema = z.object({ id: z.string() }).openapi({ title: "NotificationParams" });
export type NotificationParamsDto = z.infer<typeof NotificationParamsDtoSchema>;

// Query string de listing paginé, avec filtres facultatifs (destinataire, quartier, type, lu/non lu).
export const NotificationQueryDtoSchema = z
  .object({
    // Pagination : page >= 1, 20 par défaut, plafonnée à 100 par page.
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    recipientId: z.string().optional(),
    districtId: z.string().optional(),
    type: NotificationTypeSchema.optional(),
    // `read` arrive en query string ("true"/"false") : coercition dédiée, pas z.coerce.boolean().
    read: BooleanQueryParamSchema.optional(),
  })
  .openapi({ title: "NotificationQuery" });
export type NotificationQueryDto = z.infer<typeof NotificationQueryDtoSchema>;
export type NotificationQueryInput = z.input<typeof NotificationQueryDtoSchema>;

// Réponse au marquage global comme lu : nombre de notifications effectivement mises à jour.
export const MarkAllReadResponseDtoSchema = z
  .object({
    updated: z.number().int(),
  })
  .openapi({ title: "MarkAllReadResponse" });
export type MarkAllReadResponseDto = z.infer<typeof MarkAllReadResponseDtoSchema>;
