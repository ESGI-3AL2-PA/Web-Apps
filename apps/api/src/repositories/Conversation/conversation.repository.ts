import type { Conversation, Message } from "../../entities/conversation.entity.js";

export interface IConversationRepository {
  getConversations(params: {
    participantId?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    data: Conversation[];
    total: number;
    page: number;
    limit: number;
  }>;

  getConversationById(id: string): Promise<Conversation | null>;

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
}
