import type { Conversation, Message } from "../../entities/conversation.entity.js";

export interface IConversationRepository {
  ensureIndexes(): Promise<void>;

  getConversations(params: { participantId?: string; districtId?: string; page?: number; limit?: number }): Promise<{
    data: Conversation[];
    total: number;
    page: number;
    limit: number;
  }>;

  getConversationById(id: string): Promise<Conversation | null>;

  /** Find the existing 1:1 conversation between exactly this pair of participants,
   *  regardless of order. Used to dedupe direct conversations on create. */
  findDirectConversation(participantIds: string[]): Promise<Conversation | null>;

  createConversation(data: Omit<Conversation, "id" | "createdAt" | "lastMessageAt">): Promise<Conversation>;

  getMessages(
    conversationId: string,
    params: { page?: number; limit?: number },
  ): Promise<{
    data: Message[];
    total: number;
    page: number;
    limit: number;
  }>;

  createMessage(data: Omit<Message, "id" | "createdAt" | "read">): Promise<Message>;

  getMessageById(id: string): Promise<Message | null>;

  markMessageRead(id: string): Promise<Message | null>;

  attachMedia(id: string, mediaUrl: string, type: Message["type"]): Promise<Message | null>;

  deleteMessage(id: string): Promise<void>;

  /** Delete every message sent by a user (account deletion). Returns the ids of the
   *  deleted audio messages so the caller can remove their media files. */
  deleteUserMessages(userId: string): Promise<string[]>;
}
