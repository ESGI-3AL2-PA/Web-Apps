import type { Conversation } from "../../entities/conversation.entity.js";
import type { IConversationRepository } from "../../repositories/Conversation/conversation.repository.js";

/**
 * Cas d'usage : création d'une conversation.
 *
 * Les conversations directes (1:1) sont dédoublonnées ; les conversations de groupe sont
 * toujours créées. Renvoie la conversation (existante ou nouvellement créée).
 */
export const createConversationUseCase = (conversationRepository: IConversationRepository) => {
  return async (data: Omit<Conversation, "id" | "createdAt" | "lastMessageAt">): Promise<Conversation> => {
    // Conversations directes (1:1) dédoublonnées : on réutilise le fil existant pour la
    // même paire afin que les messages ne se dispersent pas entre doublons. Les groupes
    // créent toujours une nouvelle conversation.
    if (data.type === "direct" && data.participants.length === 2) {
      const existing = await conversationRepository.findDirectConversation(data.participants);
      if (existing) return existing;
    }
    return await conversationRepository.createConversation(data);
  };
};
