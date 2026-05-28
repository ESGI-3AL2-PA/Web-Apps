import { initServer } from "@ts-rest/express";
import { notificationsContract } from "@repo/contracts";
import { resolve } from "../../repositories/container.js";
import { getNotificationsUseCase } from "../../use-cases/notifications/get-notifications.use-case.js";
import { createNotificationUseCase } from "../../use-cases/notifications/create-notification.use-case.js";
import { markNotificationReadUseCase } from "../../use-cases/notifications/mark-notification-read.use-case.js";
import { markAllNotificationsReadUseCase } from "../../use-cases/notifications/mark-all-notifications-read.use-case.js";
import { deleteNotificationUseCase } from "../../use-cases/notifications/delete-notification.use-case.js";

const s = initServer();

export const notificationsRouter = s.router(notificationsContract, {
  getNotifications: async ({ query }) => {
    const result = await getNotificationsUseCase(resolve("notification"))(query);
    return { status: 200, body: result };
  },

  createNotification: async ({ body }) => {
    const notification = await createNotificationUseCase(resolve("notification"))(body);
    return { status: 201, body: notification };
  },

  markNotificationRead: async ({ params: { id } }) => {
    const notification = await markNotificationReadUseCase(resolve("notification"))(id);
    if (!notification) {
      return { status: 404, body: { message: "Notification not found" } };
    }
    return { status: 200, body: notification };
  },

  markAllNotificationsRead: async ({ body: { recipientId } }) => {
    const updated = await markAllNotificationsReadUseCase(resolve("notification"))(recipientId);
    return { status: 200, body: { updated } };
  },

  deleteNotification: async ({ params: { id } }) => {
    const deleted = await deleteNotificationUseCase(resolve("notification"))({ id });
    if (!deleted) {
      return { status: 404, body: { message: "Notification not found" } };
    }
    return { status: 204, body: undefined };
  },
});
