import type { UploadMediaDto } from "@repo/contracts";
import type { Message } from "../../entities/conversation.entity.js";
import type { IConversationRepository } from "../../repositories/Conversation/conversation.repository.js";

export const attachMediaUseCase = (conversationRepository: IConversationRepository) => {
  return async (id: string, data: UploadMediaDto): Promise<Message | null> => {
    return await conversationRepository.attachMedia(id, data.mediaUrl, data.type);
  };
};
