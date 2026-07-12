import type { Conversation } from "../../entities/conversation.entity.js";
import type { IConversationRepository } from "../../repositories/Conversation/conversation.repository.js";

export const createConversationUseCase = (conversationRepository: IConversationRepository) => {
  return async (data: Omit<Conversation, "id" | "createdAt" | "lastMessageAt">): Promise<Conversation> => {
    // Direct (1:1) conversations are deduped: reuse the existing thread for the same
    // pair so messages don't scatter across duplicate conversations. Groups always create.
    if (data.type === "direct" && data.participants.length === 2) {
      const existing = await conversationRepository.findDirectConversation(data.participants);
      if (existing) return existing;
    }
    return await conversationRepository.createConversation(data);
  };
};
