import type { SendMessageDto } from "@repo/contracts";
import type { Message } from "../../entities/conversation.entity.js";
import type { IConversationRepository } from "../../repositories/Conversation/conversation.repository.js";

export const sendMessageUseCase = (conversationRepository: IConversationRepository) => {
  return async (conversationId: string, senderId: string, data: SendMessageDto): Promise<Message | null> => {
    const conversation = await conversationRepository.getConversationById(conversationId);
    if (!conversation) return null;

    return await conversationRepository.createMessage({
      conversationId,
      senderId,
      districtId: conversation.districtId,
      type: data.type,
      content: data.content,
      mediaUrl: data.mediaUrl,
    });
  };
};
