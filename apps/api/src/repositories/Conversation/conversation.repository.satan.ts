import { quote, type SatanClient } from "@repo/satan";
import type { Conversation, Message } from "../../entities/conversation.entity.js";
import type { IConversationRepository } from "./conversation.repository.js";

/** SATAN QL for the two id lookups and the single-message delete; Mongo for the
 *  order-insensitive pair match, paginated lists, the two-collection message
 *  create and the read-then-delete cascade. */
export class SatanConversationRepository implements IConversationRepository {
  constructor(
    private readonly mongo: IConversationRepository,
    private readonly satan: SatanClient,
  ) {}

  async getConversationById(id: string): Promise<Conversation | null> {
    const rows = (await this.satan.query(`FIND conversations WHERE _id = ${quote(id)}`)) as Conversation[];
    return rows[0] ?? null;
  }

  async getMessageById(id: string): Promise<Message | null> {
    const rows = (await this.satan.query(`FIND messages WHERE _id = ${quote(id)}`)) as Message[];
    return rows[0] ?? null;
  }

  async deleteMessage(id: string): Promise<void> {
    await this.satan.query(`DELETE FROM messages WHERE _id = ${quote(id)}`);
  }

  // --- delegated to Mongo ---
  ensureIndexes(): Promise<void> {
    return this.mongo.ensureIndexes();
  }
  getConversations(params: Parameters<IConversationRepository["getConversations"]>[0]) {
    return this.mongo.getConversations(params);
  }
  findDirectConversation(participantIds: string[]): Promise<Conversation | null> {
    return this.mongo.findDirectConversation(participantIds);
  }
  createConversation(data: Omit<Conversation, "id" | "createdAt" | "lastMessageAt">): Promise<Conversation> {
    return this.mongo.createConversation(data);
  }
  getMessages(conversationId: string, params: { page?: number; limit?: number }) {
    return this.mongo.getMessages(conversationId, params);
  }
  createMessage(data: Omit<Message, "id" | "createdAt" | "read">): Promise<Message> {
    return this.mongo.createMessage(data);
  }
  markMessageRead(id: string): Promise<Message | null> {
    return this.mongo.markMessageRead(id);
  }
  attachMedia(id: string, mediaUrl: string, type: Message["type"]): Promise<Message | null> {
    return this.mongo.attachMedia(id, mediaUrl, type);
  }
  deleteUserMessages(userId: string): Promise<string[]> {
    return this.mongo.deleteUserMessages(userId);
  }
}
