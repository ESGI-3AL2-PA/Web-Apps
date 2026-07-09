import { randomUUID } from "crypto";
import type { Collection, Db, Filter } from "mongodb";
import type { Conversation, Message } from "../../entities/conversation.entity.js";
import type { IConversationRepository } from "./conversation.repository.js";

type ConversationDoc = Omit<Conversation, "id"> & { _id: string };
type MessageDoc = Omit<Message, "id"> & { _id: string };

export class MongoConversationRepository implements IConversationRepository {
  private conversations: Collection<ConversationDoc>;
  private messages: Collection<MessageDoc>;

  constructor(db: Db) {
    this.conversations = db.collection("conversations");
    this.messages = db.collection("messages");
  }

  async ensureIndexes(): Promise<void> {
    // Backs district-scoped (admin) conversation list filtering.
    await this.conversations.createIndex({ districtId: 1 });
  }

  async getConversations(params: {
    participantId?: string;
    districtId?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    data: Conversation[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { participantId, districtId, page = 1, limit = 20 } = params;

    const filter: Filter<ConversationDoc> = {};
    if (participantId) filter.participants = participantId;
    if (districtId) filter.districtId = districtId;

    const [total, docs] = await Promise.all([
      this.conversations.countDocuments(filter),
      this.conversations
        .find(filter)
        .sort({ lastMessageAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
    ]);

    return { data: docs.map(this.toConversation), total, page, limit };
  }

  async getConversationById(id: string): Promise<Conversation | null> {
    const doc = await this.conversations.findOne({ _id: id });
    return doc ? this.toConversation(doc) : null;
  }

  async createConversation(data: Omit<Conversation, "id" | "createdAt" | "lastMessageAt">): Promise<Conversation> {
    const now = new Date().toISOString();
    const doc: ConversationDoc = { ...data, _id: randomUUID(), createdAt: now };
    await this.conversations.insertOne(doc);
    return this.toConversation(doc);
  }

  async getMessages(
    conversationId: string,
    params: { page?: number; limit?: number },
  ): Promise<{ data: Message[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 50 } = params;

    const filter: Filter<MessageDoc> = { conversationId };

    const [total, docs] = await Promise.all([
      this.messages.countDocuments(filter),
      this.messages
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
    ]);

    return { data: docs.map(this.toMessage), total, page, limit };
  }

  async createMessage(data: Omit<Message, "id" | "createdAt" | "read">): Promise<Message> {
    const now = new Date().toISOString();
    const doc: MessageDoc = { ...data, _id: randomUUID(), createdAt: now, read: false };

    await Promise.all([
      this.messages.insertOne(doc),
      this.conversations.updateOne({ _id: data.conversationId }, { $set: { lastMessageAt: now } }),
    ]);

    return this.toMessage(doc);
  }

  async getMessageById(id: string): Promise<Message | null> {
    const doc = await this.messages.findOne({ _id: id });
    return doc ? this.toMessage(doc) : null;
  }

  async markMessageRead(id: string): Promise<Message | null> {
    const result = await this.messages.findOneAndUpdate(
      { _id: id },
      { $set: { read: true } },
      { returnDocument: "after" },
    );
    return result ? this.toMessage(result) : null;
  }

  async attachMedia(id: string, mediaUrl: string, type: Message["type"]): Promise<Message | null> {
    const result = await this.messages.findOneAndUpdate(
      { _id: id },
      { $set: { mediaUrl, type } },
      { returnDocument: "after" },
    );
    return result ? this.toMessage(result) : null;
  }

  async deleteMessage(id: string): Promise<void> {
    await this.messages.deleteOne({ _id: id });
  }

  async deleteUserMessages(userId: string): Promise<string[]> {
    const audioDocs = await this.messages
      .find({ senderId: userId, type: "audio" }, { projection: { _id: 1 } })
      .toArray();
    const audioIds = audioDocs.map((d) => d._id);
    await this.messages.deleteMany({ senderId: userId });
    return audioIds;
  }

  private toConversation(doc: ConversationDoc): Conversation {
    const { _id, ...rest } = doc;
    return { id: _id, ...rest };
  }

  private toMessage(doc: MessageDoc): Message {
    const { _id, ...rest } = doc;
    return { id: _id, ...rest };
  }
}
