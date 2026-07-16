import { quote, type SatanClient } from "@repo/satan";
import type { Conversation, Message } from "../../entities/conversation.entity.js";
import type { IConversationRepository } from "./conversation.repository.js";
import { eq, paginate, where } from "../satan.helpers.js";

/** SATAN QL for the two id lookups, the single-message delete and the two
 *  paginated lists (COUNT + FIND, newest first); Mongo for the order-insensitive
 *  pair match, the two-collection message create and the read-then-delete
 *  cascade. */
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

  getConversations(params: Parameters<IConversationRepository["getConversations"]>[0]) {
    const { participantId, districtId, page = 1, limit = 20 } = params;
    const clause = where([
      participantId && eq("participants", participantId),
      districtId && eq("districtId", districtId),
    ]);
    return paginate<Conversation>(this.satan, "conversations", clause, { page, limit, sort: "lastMessageAt DESC" });
  }

  getMessages(conversationId: string, params: { page?: number; limit?: number }) {
    const { page = 1, limit = 50 } = params;
    const clause = where([eq("conversationId", conversationId)]);
    return paginate<Message>(this.satan, "messages", clause, { page, limit, sort: "createdAt DESC" });
  }

  // --- delegated to Mongo (pair match / two-collection writes / cascade) ---
  ensureIndexes(): Promise<void> {
    return this.mongo.ensureIndexes();
  }
  findDirectConversation(participantIds: string[]): Promise<Conversation | null> {
    return this.mongo.findDirectConversation(participantIds);
  }
  createConversation(data: Omit<Conversation, "id" | "createdAt" | "lastMessageAt">): Promise<Conversation> {
    return this.mongo.createConversation(data);
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
  deleteUserMessages(userId: string): Promise<{ audioIds: string[]; imageIds: string[] }> {
    return this.mongo.deleteUserMessages(userId);
  }
}
