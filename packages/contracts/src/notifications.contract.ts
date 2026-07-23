import { initContract } from "@ts-rest/core";
import { z } from "zod";

import {
  CreateNotificationDtoSchema,
  MarkAllReadResponseDtoSchema,
  NotificationParamsDtoSchema,
  NotificationQueryDtoSchema,
  NotificationResponseDtoSchema,
  NotFoundErrorSchema,
  ForbiddenErrorSchema,
  PaginatedResponseDtoSchema,
} from "./DTO";
import { auth } from "./auth-meta";

const c = initContract();

/**
 * Contract ts-rest des notifications.
 *
 * Une notification appartient à un unique destinataire. Marquer une
 * notification comme lue ou la supprimer relève d'une action strictement
 * personnelle : aucun bypass admin/superAdmin (lire l'état de la boîte de
 * réception de quelqu'un n'est pas de la modération). La création est réservée
 * aux admins, mais elle est normalement déclenchée côté serveur.
 */
export const notificationsContract = c.router({
  // GET /notifications — liste paginée des notifications. Tout utilisateur authentifié.
  getNotifications: {
    method: "GET",
    path: "/notifications",
    query: NotificationQueryDtoSchema,
    responses: {
      200: PaginatedResponseDtoSchema(NotificationResponseDtoSchema),
    },
    summary: "Get a paginated list of notifications",
    metadata: auth({ audience: "api" }),
  },

  // POST /notifications — crée une notification (admin uniquement ; normalement déclenché côté serveur).
  createNotification: {
    method: "POST",
    path: "/notifications",
    body: CreateNotificationDtoSchema,
    responses: {
      201: NotificationResponseDtoSchema,
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Create a notification (admin only; normally triggered server-side)",
    metadata: auth({ audience: "api", roles: ["admin", "superAdmin"] }),
  },

  markNotificationRead: {
    method: "PATCH",
    path: "/notifications/:id/read",
    pathParams: NotificationParamsDtoSchema,
    body: c.noBody(),
    responses: {
      200: NotificationResponseDtoSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Mark a single notification as read (recipient only)",
    // PATCH /notifications/:id/read — marque une notification comme lue. Destinataire uniquement.
    // Une notification appartient à exactement une personne. Pas de districtField ni de bypassRoles :
    // lire l'état de la boîte de réception de quelqu'un n'est pas de la modération, donc ni un admin de
    // quartier ni un superAdmin ne peuvent la marquer lue à sa place. Même raisonnement que pour les
    // écritures de conversation.
    metadata: auth({
      audience: "api",
      scope: {
        resource: "notification",
        ownerField: "recipientId",
        notFoundOnDeny: true,
      },
    }),
  },

  // PATCH /notifications/read-all — marque toutes les notifications de l'utilisateur authentifié comme lues.
  markAllNotificationsRead: {
    method: "PATCH",
    path: "/notifications/read-all",
    body: c.noBody(),
    responses: {
      200: MarkAllReadResponseDtoSchema,
    },
    summary: "Mark all of the authenticated user's notifications as read",
    metadata: auth({ audience: "api" }),
  },

  deleteNotification: {
    method: "DELETE",
    path: "/notifications/:id",
    pathParams: NotificationParamsDtoSchema,
    body: c.noBody(),
    responses: {
      204: z.undefined(),
      404: NotFoundErrorSchema,
    },
    summary: "Delete a notification (recipient only)",
    // DELETE /notifications/:id — supprime une notification. Destinataire uniquement (404-sur-refus).
    metadata: auth({
      audience: "api",
      scope: {
        resource: "notification",
        ownerField: "recipientId",
        notFoundOnDeny: true,
      },
    }),
  },
});
