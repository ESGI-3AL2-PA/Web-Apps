import { initContract } from "@ts-rest/core";
import { z } from "zod";

import {
  CreateNotificationDtoSchema,
  MarkAllReadDtoSchema,
  MarkAllReadResponseDtoSchema,
  NotificationParamsDtoSchema,
  NotificationQueryDtoSchema,
  NotificationResponseDtoSchema,
  NotFoundErrorSchema,
  PaginatedResponseDtoSchema,
} from "./DTO";

const c = initContract();

export const notificationsContract = c.router({
  getNotifications: {
    method: "GET",
    path: "/notifications",
    query: NotificationQueryDtoSchema,
    responses: {
      200: PaginatedResponseDtoSchema(NotificationResponseDtoSchema),
    },
    summary: "Get a paginated list of notifications",
  },

  createNotification: {
    method: "POST",
    path: "/notifications",
    body: CreateNotificationDtoSchema,
    responses: {
      201: NotificationResponseDtoSchema,
    },
    summary: "Create a notification (typically triggered server-side)",
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
    summary: "Mark a single notification as read",
  },

  markAllNotificationsRead: {
    method: "PATCH",
    path: "/notifications/read-all",
    body: MarkAllReadDtoSchema,
    responses: {
      200: MarkAllReadResponseDtoSchema,
    },
    summary: "Mark all notifications of a recipient as read",
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
    summary: "Delete a notification",
  },
});
