import type { IConversationRepository } from "../../repositories/Conversation/conversation.repository.js";

export const getConversationByIdUseCase = (conversationRepository: IConversationRepository) => {
  return async (params: { id: string }) => {
    return await conversationRepository.getConversationById(params.id);
  };
};
