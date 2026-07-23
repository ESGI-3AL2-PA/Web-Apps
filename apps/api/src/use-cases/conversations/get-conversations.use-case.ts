// Cas d'usage (couche conversations) : liste paginée des conversations.
// Simple pass-through vers le repository ; le filtrage/pagination y est fait.
import type { IConversationRepository } from "../../repositories/Conversation/conversation.repository.js";

/**
 * Factory du cas d'usage « lister les conversations ».
 * @param conversationRepository repository des conversations
 * @returns une fonction qui, à partir de filtres optionnels (participantId,
 *   districtId = quartier) et d'une pagination (page/limit), retourne la page
 *   de conversations correspondante.
 */
export const getConversationsUseCase = (conversationRepository: IConversationRepository) => {
  return async (params: { participantId?: string; districtId?: string; page?: number; limit?: number }) => {
    return await conversationRepository.getConversations(params);
  };
};
