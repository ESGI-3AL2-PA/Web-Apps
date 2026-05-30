import { z } from "zod";

export const ConversationTypeSchema = z.enum(["direct", "group"]);
export type ConversationType = z.infer<typeof ConversationTypeSchema>;

export const ConversationSchema = z.object({
  id: z.string(),
  participants: z.array(z.string()),
  type: ConversationTypeSchema,
  name: z.string().optional(),
  lastMessageAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
});
export type Conversation = z.infer<typeof ConversationSchema>;

export const MessageTypeSchema = z.enum(["text", "image", "audio", "file"]);
export type MessageType = z.infer<typeof MessageTypeSchema>;

export const MessageSchema = z.object({
  id: z.string(),
  senderId: z.string(),
  conversationId: z.string(),
  type: MessageTypeSchema,
  content: z.string(),
  mediaUrl: z.string().optional(),
  read: z.boolean(),
  createdAt: z.string().datetime(),
});
export type Message = z.infer<typeof MessageSchema>;
