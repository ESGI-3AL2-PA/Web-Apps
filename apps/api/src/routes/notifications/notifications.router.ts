import { initServer } from "@ts-rest/express";
import { notificationsContract } from "@repo/contracts";
import { resolve } from "../../repositories/container.js";
import type { IUserRepository } from "../../repositories/User/user.repository.js";
import { resolveListDistrictScope } from "../../middleware/district-scope.js";
import { getNotificationsUseCase } from "../../use-cases/notifications/get-notifications.use-case.js";
import { createNotificationUseCase } from "../../use-cases/notifications/create-notification.use-case.js";
import { markNotificationReadUseCase } from "../../use-cases/notifications/mark-notification-read.use-case.js";
import { markAllNotificationsReadUseCase } from "../../use-cases/notifications/mark-all-notifications-read.use-case.js";
import { deleteNotificationUseCase } from "../../use-cases/notifications/delete-notification.use-case.js";
import { broadcastNewNotification } from "../../sockets/io.js";

const s = initServer();

/**
 * Router ts-rest des notifications.
 *
 * Couche router : chaque handler résout ses repositories via `resolve(...)` puis
 * délègue au cas d'usage correspondant. Le scoping par quartier passe par les
 * helpers `district-scope`, l'autorisation fine (admin-only, destinataire-only)
 * est imposée en amont par le middleware contract-metadata.
 */
export const notificationsRouter = s.router(notificationsContract, {
  getNotifications: async ({ query, req }) => {
    // Un user ne voit que ses propres notifications ; un admin peut filtrer
    // librement à l'intérieur de son quartier.
    const isAdmin = req.user!.role === "admin";
    const scope = resolveListDistrictScope(req.user!, query.districtId);
    if ("empty" in scope) {
      return { status: 200, body: { data: [], total: 0, page: query.page, limit: query.limit } };
    }
    const scoped = isAdmin
      ? { ...query, districtId: scope.districtId }
      : { ...query, recipientId: req.user!.sub, districtId: scope.districtId };
    const result = await getNotificationsUseCase(resolve("notification"))(scoped);
    return { status: 200, body: result };
  },

  createNotification: async ({ body }) => {
    // Restriction admin-only imposée par le middleware contract-metadata.
    const userRepo: IUserRepository = resolve("user");
    const recipient = await userRepo.getUserById(body.recipientId);
    if (!recipient) {
      return { status: 404, body: { message: "Recipient not found" } };
    }
    // Le quartier de la notification est celui du destinataire, pas un champ libre.
    const notification = await createNotificationUseCase(resolve("notification"))({
      ...body,
      districtId: recipient.districtId,
    });
    // Push au destinataire connecté (il refetchera automatiquement).
    broadcastNewNotification(notification.recipientId, notification);
    return { status: 201, body: notification };
  },

  markNotificationRead: async ({ params: { id } }) => {
    // Autorisation destinataire-only (404 en cas de refus) imposée par le middleware contract-metadata.
    const notification = await markNotificationReadUseCase(resolve("notification"))(id);
    if (!notification) {
      return { status: 404, body: { message: "Notification not found" } };
    }
    return { status: 200, body: notification };
  },

  markAllNotificationsRead: async ({ req }) => {
    const updated = await markAllNotificationsReadUseCase(resolve("notification"))(req.user!.sub);
    return { status: 200, body: { updated } };
  },

  deleteNotification: async ({ params: { id } }) => {
    // Autorisation destinataire-only (404 en cas de refus) imposée par le middleware contract-metadata.
    const deleted = await deleteNotificationUseCase(resolve("notification"))({ id });
    if (!deleted) {
      return { status: 404, body: { message: "Notification not found" } };
    }
    return { status: 204, body: undefined };
  },
});
