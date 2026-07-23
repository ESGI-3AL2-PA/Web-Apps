import type { UploadMediaDto } from "@repo/contracts";
import type { Message } from "../../entities/conversation.entity.js";
import type { IConversationRepository } from "../../repositories/Conversation/conversation.repository.js";

/**
 * Cas d'usage : ajout d'un média (image, etc.) comme message dans une conversation.
 * Pass-through vers le repository ; renvoie le message créé, ou `null` si la conversation
 * n'existe pas (→ 404).
 */
export const attachMediaUseCase = (conversationRepository: IConversationRepository) => {
  return async (id: string, data: UploadMediaDto): Promise<Message | null> => {
    return await conversationRepository.attachMedia(id, data.mediaUrl, data.type);
  };
};
