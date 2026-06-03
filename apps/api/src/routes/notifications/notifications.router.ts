import { initServer } from "@ts-rest/express";
import { notificationsContract } from "@repo/contracts";
import { resolve } from "../../repositories/container.js";
import type { INotificationRepository } from "../../repositories/Notification/notification.repository.js";
import { getNotificationsUseCase } from "../../use-cases/notifications/get-notifications.use-case.js";
import { createNotificationUseCase } from "../../use-cases/notifications/create-notification.use-case.js";
import { markNotificationReadUseCase } from "../../use-cases/notifications/mark-notification-read.use-case.js";
import { markAllNotificationsReadUseCase } from "../../use-cases/notifications/mark-all-notifications-read.use-case.js";
import { deleteNotificationUseCase } from "../../use-cases/notifications/delete-notification.use-case.js";

const s = initServer();

export const notificationsRouter = s.router(notificationsContract, {
  getNotifications: async ({ query, req }) => {
    // Users only see their own notifications; admins may filter freely.
    const isAdmin = req.user!.role === "admin";
    const scoped = isAdmin ? query : { ...query, recipientId: req.user!.sub };
    const result = await getNotificationsUseCase(resolve("notification"))(scoped);
    return { status: 200, body: result };
  },

  createNotification: async ({ body, req }) => {
    // Users must not be able to push notifications to other users.
    if (req.user!.role !== "admin") {
      return { status: 403, body: { message: "Admin only" } };
    }
    const notification = await createNotificationUseCase(resolve("notification"))(body);
    return { status: 201, body: notification };
  },

  markNotificationRead: async ({ params: { id }, req }) => {
    const repo: INotificationRepository = resolve("notification");
    const existing = await repo.getNotificationById(id);
    if (!existing || (existing.recipientId !== req.user!.sub && req.user!.role !== "admin")) {
      return { status: 404, body: { message: "Notification not found" } };
    }
    const notification = await markNotificationReadUseCase(repo)(id);
    if (!notification) {
      return { status: 404, body: { message: "Notification not found" } };
    }
    return { status: 200, body: notification };
  },

  markAllNotificationsRead: async ({ req }) => {
    const updated = await markAllNotificationsReadUseCase(resolve("notification"))(req.user!.sub);
    return { status: 200, body: { updated } };
  },

  deleteNotification: async ({ params: { id }, req }) => {
    const repo: INotificationRepository = resolve("notification");
    const existing = await repo.getNotificationById(id);
    if (!existing || (existing.recipientId !== req.user!.sub && req.user!.role !== "admin")) {
      return { status: 404, body: { message: "Notification not found" } };
    }
    const deleted = await deleteNotificationUseCase(repo)({ id });
    if (!deleted) {
      return { status: 404, body: { message: "Notification not found" } };
    }
    return { status: 204, body: undefined };
  },
});
