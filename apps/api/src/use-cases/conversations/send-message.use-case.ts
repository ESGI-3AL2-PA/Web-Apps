import type { SendMessageDto } from "@repo/contracts";
import type { Message } from "../../entities/conversation.entity.js";
import type { IConversationRepository } from "../../repositories/Conversation/conversation.repository.js";

export const sendMessageUseCase = (conversationRepository: IConversationRepository) => {
  return async (
    conversationId: string,
    senderId: string,
    data: SendMessageDto,
  ): Promise<{ message: Message; participants: string[] } | null> => {
    const conversation = await conversationRepository.getConversationById(conversationId);
    if (!conversation) return null;

    const message = await conversationRepository.createMessage({
      conversationId,
      senderId,
      districtId: conversation.districtId,
      type: data.type,
      content: data.content,
      mediaUrl: data.mediaUrl,
    });

    // Le broadcast socket (effet de bord transport) est laissé au routeur pour garder
    // ce use-case pur — cohérent avec le chemin vocal (voice-message.handler).
    return { message, participants: conversation.participants };
  };
};
