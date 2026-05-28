import type { Message } from "../../entities/conversation.entity.js";
import type { IConversationRepository } from "../../repositories/Conversation/conversation.repository.js";

export const markMessageReadUseCase = (conversationRepository: IConversationRepository) => {
  return async (id: string): Promise<Message | null> => {
    return await conversationRepository.markMessageRead(id);
  };
};
