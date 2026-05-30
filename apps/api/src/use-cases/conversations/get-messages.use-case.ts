import type { IConversationRepository } from "../../repositories/Conversation/conversation.repository.js";

export const getMessagesUseCase = (conversationRepository: IConversationRepository) => {
  return async (conversationId: string, params: { page?: number; limit?: number }) => {
    return await conversationRepository.getMessages(conversationId, params);
  };
};
