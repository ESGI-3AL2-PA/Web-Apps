import type { CreateConversationDto } from "@repo/contracts";
import type { Conversation } from "../../entities/conversation.entity.js";
import type { IConversationRepository } from "../../repositories/Conversation/conversation.repository.js";

export const createConversationUseCase = (conversationRepository: IConversationRepository) => {
  return async (data: CreateConversationDto): Promise<Conversation> => {
    return await conversationRepository.createConversation(data);
  };
};
