import type { IConversationRepository } from "../../repositories/Conversation/conversation.repository.js";

/**
 * Cas d'usage : récupération d'une conversation par son id (pass-through vers le
 * repository). Renvoie la conversation ou `null` si elle n'existe pas.
 */
export const getConversationByIdUseCase = (conversationRepository: IConversationRepository) => {
  return async (params: { id: string }) => {
    return await conversationRepository.getConversationById(params.id);
  };
};
