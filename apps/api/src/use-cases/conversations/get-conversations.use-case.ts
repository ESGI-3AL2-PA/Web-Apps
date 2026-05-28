import type { IConversationRepository } from "../../repositories/Conversation/conversation.repository.js";

export const getConversationsUseCase = (conversationRepository: IConversationRepository) => {
  return async (params: { participantId?: string; page?: number; limit?: number }) => {
    return await conversationRepository.getConversations(params);
  };
};
