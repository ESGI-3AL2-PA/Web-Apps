import { z } from "zod";

export const NotificationTypeSchema = z.enum([
  "listing",
  "contract",
  "event",
  "message",
  "vote",
  "incident",
  "system",
]);
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

export const NotificationSchema = z.object({
  id: z.string(),
  recipientId: z.string(),
  type: NotificationTypeSchema,
  title: z.string().min(1).max(200),
  message: z.string().min(1),
  refId: z.string().optional(),
  refType: NotificationRefTypeSchema.optional(),
  read: z.boolean(),
  createdAt: z.string().datetime(),
});

export type Notification = z.infer<typeof NotificationSchema>;
