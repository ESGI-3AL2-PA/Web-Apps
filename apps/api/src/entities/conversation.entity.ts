import { z } from "zod";

// Entités de messagerie : Conversation (fil entre participants d'un même quartier)
// et Message (contenu individuel rattaché à une conversation). Deux collections Mongo distinctes.

// Type de conversation : direct (à deux) ou group (fil de groupe nommé).
export const ConversationTypeSchema = z.enum(["direct", "group"]);
export type ConversationType = z.infer<typeof ConversationTypeSchema>;

export const ConversationSchema = z.object({
  id: z.string(),
  // Ids des utilisateurs participant au fil.
  participants: z.array(z.string()),
  districtId: z.string(),
  type: ConversationTypeSchema,
  // Optionnel : pertinent surtout pour les conversations de groupe.
  name: z.string().optional(),
  // Horodatage du dernier message, sert au tri des fils ; absent tant qu'aucun message.
  lastMessageAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
});
export type Conversation = z.infer<typeof ConversationSchema>;

// Nature du contenu d'un message ; les types non-text s'appuient sur `mediaUrl`.
export const MessageTypeSchema = z.enum(["text", "image", "audio", "file"]);
export type MessageType = z.infer<typeof MessageTypeSchema>;

export const MessageSchema = z.object({
  id: z.string(),
  senderId: z.string(),
  conversationId: z.string(),
  districtId: z.string(),
  type: MessageTypeSchema,
  content: z.string(),
  // URL du média (image/audio/fichier) ; absent pour un message texte.
  mediaUrl: z.string().optional(),
  // Accusé de lecture par le destinataire.
  read: z.boolean(),
  createdAt: z.string().datetime(),
});
export type Message = z.infer<typeof MessageSchema>;
