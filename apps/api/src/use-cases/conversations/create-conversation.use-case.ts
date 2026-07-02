import type { Conversation } from "../../entities/conversation.entity.js";
import type { IConversationRepository } from "../../repositories/Conversation/conversation.repository.js";

export const createConversationUseCase = (conversationRepository: IConversationRepository) => {
  return async (data: Omit<Conversation, "id" | "createdAt" | "lastMessageAt">): Promise<Conversation> => {
    return await conversationRepository.createConversation(data);
  };
};
