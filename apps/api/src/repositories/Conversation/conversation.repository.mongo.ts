import { randomUUID } from "crypto";
import type { Collection, Db, Filter } from "mongodb";
import { toEntity, type WithMongoId } from "@repo/shared";
import type { Conversation, Message } from "../../entities/conversation.entity.js";
import type { IConversationRepository } from "./conversation.repository.js";

type ConversationDoc = WithMongoId<Conversation>;
type MessageDoc = WithMongoId<Message>;

/**
 * Implémentation Mongo du repository de messagerie.
 *
 * Persiste deux collections : `conversations` et `messages`. Chaque création de
 * message met aussi à jour `lastMessageAt` sur la conversation parente.
 */
export class MongoConversationRepository implements IConversationRepository {
  private conversations: Collection<ConversationDoc>;
  private messages: Collection<MessageDoc>;

  constructor(db: Db) {
    this.conversations = db.collection("conversations");
    this.messages = db.collection("messages");
  }

  async ensureIndexes(): Promise<void> {
    // Sous-tend le filtrage de la liste des conversations par quartier (côté admin).
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

    return { data: docs.map((d) => toEntity<Conversation>(d)), total, page, limit };
  }

  async getConversationById(id: string): Promise<Conversation | null> {
    const doc = await this.conversations.findOne({ _id: id });
    return doc ? toEntity<Conversation>(doc) : null;
  }

  async findDirectConversation(participantIds: string[]): Promise<Conversation | null> {
    // Match exact de la paire indépendant de l'ordre : même ensemble, même taille,
    // type direct ($all + $size garantit qu'il n'y a aucun participant en plus).
    const doc = await this.conversations.findOne({
      type: "direct",
      participants: { $all: participantIds, $size: participantIds.length },
    });
    return doc ? toEntity<Conversation>(doc) : null;
  }

  async createConversation(data: Omit<Conversation, "id" | "createdAt" | "lastMessageAt">): Promise<Conversation> {
    const now = new Date().toISOString();
    const doc: ConversationDoc = { ...data, _id: randomUUID(), createdAt: now };
    await this.conversations.insertOne(doc);
    return toEntity<Conversation>(doc);
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

    return { data: docs.map((d) => toEntity<Message>(d)), total, page, limit };
  }

  async createMessage(data: Omit<Message, "id" | "createdAt" | "read">): Promise<Message> {
    const now = new Date().toISOString();
    const doc: MessageDoc = { ...data, _id: randomUUID(), createdAt: now, read: false };

    // Insertion du message + bump de `lastMessageAt` sur la conversation, en
    // parallèle, pour que le tri des conversations reflète l'activité récente.
    await Promise.all([
      this.messages.insertOne(doc),
      this.conversations.updateOne({ _id: data.conversationId }, { $set: { lastMessageAt: now } }),
    ]);

    return toEntity<Message>(doc);
  }

  async getMessageById(id: string): Promise<Message | null> {
    const doc = await this.messages.findOne({ _id: id });
    return doc ? toEntity<Message>(doc) : null;
  }

  async markMessageRead(id: string): Promise<Message | null> {
    const result = await this.messages.findOneAndUpdate(
      { _id: id },
      { $set: { read: true } },
      { returnDocument: "after" },
    );
    return result ? toEntity<Message>(result) : null;
  }

  async attachMedia(id: string, mediaUrl: string, type: Message["type"]): Promise<Message | null> {
    const result = await this.messages.findOneAndUpdate(
      { _id: id },
      { $set: { mediaUrl, type } },
      { returnDocument: "after" },
    );
    return result ? toEntity<Message>(result) : null;
  }

  async deleteMessage(id: string): Promise<void> {
    await this.messages.deleteOne({ _id: id });
  }

  async deleteUserMessages(userId: string): Promise<{ audioIds: string[]; imageIds: string[] }> {
    // On collecte les ids des messages média (audio + image) AVANT de supprimer les
    // lignes, pour pouvoir aussi retirer leurs objets stockés. Les deux sont privés,
    // indexés par l'id du message.
    const mediaDocs = await this.messages
      .find({ senderId: userId, type: { $in: ["audio", "image"] } }, { projection: { _id: 1, type: 1 } })
      .toArray();
    const audioIds = mediaDocs.filter((d) => d.type === "audio").map((d) => d._id);
    const imageIds = mediaDocs.filter((d) => d.type === "image").map((d) => d._id);
    await this.messages.deleteMany({ senderId: userId });
    return { audioIds, imageIds };
  }
}
