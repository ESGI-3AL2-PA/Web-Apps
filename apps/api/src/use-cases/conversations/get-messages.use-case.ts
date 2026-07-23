// Cas d'usage (couche conversations) : liste paginée des messages d'une conversation.
// Simple pass-through vers le repository.
import type { IConversationRepository } from "../../repositories/Conversation/conversation.repository.js";

/**
 * Factory du cas d'usage « lister les messages d'une conversation ».
 * @param conversationRepository repository des conversations
 * @returns une fonction (conversationId, pagination) → page de messages.
 */
export const getMessagesUseCase = (conversationRepository: IConversationRepository) => {
  return async (conversationId: string, params: { page?: number; limit?: number }) => {
    return await conversationRepository.getMessages(conversationId, params);
  };
};
