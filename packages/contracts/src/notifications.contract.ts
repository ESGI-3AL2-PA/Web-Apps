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

export const notificationsContract = c.router({
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
    summary: "Mark a single notification as read (recipient or admin)",
    metadata: auth({
      audience: "api",
      scope: {
        resource: "notification",
        ownerField: "recipientId",
        districtField: "districtId",
        bypassRoles: ["superAdmin"],
        notFoundOnDeny: true,
      },
    }),
  },

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
    summary: "Delete a notification (recipient or admin)",
    metadata: auth({
      audience: "api",
      scope: {
        resource: "notification",
        ownerField: "recipientId",
        districtField: "districtId",
        bypassRoles: ["superAdmin"],
        notFoundOnDeny: true,
      },
    }),
  },
});
