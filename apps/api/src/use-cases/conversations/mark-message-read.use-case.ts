// Cas d'usage (couche conversations) : marquer un message comme lu.
// Simple pass-through vers le repository.
import type { Message } from "../../entities/conversation.entity.js";
import type { IConversationRepository } from "../../repositories/Conversation/conversation.repository.js";

/**
 * Factory du cas d'usage « marquer un message comme lu ».
 * @param conversationRepository repository des conversations
 * @returns une fonction (id du message) → le message mis à jour, ou `null` s'il
 *   n'existe pas.
 */
export const markMessageReadUseCase = (conversationRepository: IConversationRepository) => {
  return async (id: string): Promise<Message | null> => {
    return await conversationRepository.markMessageRead(id);
  };
};
