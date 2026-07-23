import type { Conversation, Message } from "../../entities/conversation.entity.js";

/**
 * Interface du repository de messagerie (couche persistance).
 *
 * Gère deux collections liées : les conversations (directes 1:1 ou scopées à un
 * quartier) et leurs messages (texte / audio / image). L'horodatage
 * `lastMessageAt` de la conversation est maintenu à jour à chaque nouveau message
 * pour trier les conversations les plus récentes en tête.
 */
export interface IConversationRepository {
  ensureIndexes(): Promise<void>;

  getConversations(params: { participantId?: string; districtId?: string; page?: number; limit?: number }): Promise<{
    data: Conversation[];
    total: number;
    page: number;
    limit: number;
  }>;

  getConversationById(id: string): Promise<Conversation | null>;

  /** Trouve la conversation 1:1 existante entre exactement cette paire de
   *  participants, indépendamment de l'ordre. Sert à dédupliquer les conversations
   *  directes à la création. */
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

  /** Supprime tous les messages envoyés par un utilisateur (suppression de compte)
   *  et renvoie les ids de ceux dont l'objet média doit aussi être retiré du
   *  stockage, ventilés par type : audio et image vivent dans des buckets
   *  différents et passent par des appels de suppression distincts. */
  deleteUserMessages(userId: string): Promise<{ audioIds: string[]; imageIds: string[] }>;
}
