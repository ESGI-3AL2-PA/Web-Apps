import { z } from "../zod";
import { BooleanQueryParamSchema } from "./query.dto";

export const NotificationTypeSchema = z.enum(["listing", "contract", "event", "message", "vote", "incident", "system"]);
export type NotificationType = z.infer<typeof NotificationTypeSchema>;

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

export const NotificationParamsDtoSchema = z.object({ id: z.string() }).openapi({ title: "NotificationParams" });
export type NotificationParamsDto = z.infer<typeof NotificationParamsDtoSchema>;

export const NotificationQueryDtoSchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    recipientId: z.string().optional(),
    districtId: z.string().optional(),
    type: NotificationTypeSchema.optional(),
    read: BooleanQueryParamSchema.optional(),
  })
  .openapi({ title: "NotificationQuery" });
export type NotificationQueryDto = z.infer<typeof NotificationQueryDtoSchema>;
export type NotificationQueryInput = z.input<typeof NotificationQueryDtoSchema>;

export const MarkAllReadResponseDtoSchema = z
  .object({
    updated: z.number().int(),
  })
  .openapi({ title: "MarkAllReadResponse" });
export type MarkAllReadResponseDto = z.infer<typeof MarkAllReadResponseDtoSchema>;
