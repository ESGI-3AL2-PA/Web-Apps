import type { Message } from "../../entities/conversation.entity.js";
import type { IConversationRepository } from "../../repositories/Conversation/conversation.repository.js";
import { saveAudioFromBase64 } from "../../services/media-storage.service.js";

export const sendVoiceMessageUseCase = (conversationRepository: IConversationRepository) => {
  return async (
    conversationId: string,
    senderId: string,
    audioBase64: string,
  ): Promise<{ message: Message; participants: string[] } | null> => {
    const conversation = await conversationRepository.getConversationById(conversationId);
    // Not-found et non-participant retombent tous deux sur 404 côté routeur (on ne
    // divulgue pas l'existence d'une conversation dont on n'est pas membre).
    if (!conversation || !conversation.participants.includes(senderId)) return null;

    // 1) Crée le message (sans mediaUrl pour l'instant).
    const message = await conversationRepository.createMessage({
      conversationId,
      senderId,
      districtId: conversation.districtId,
      type: "audio",
      content: "[message vocal]",
    });

    // 2) Sauve l'audio sous storage/messages/{messageId}.webm. Le nom dépend de l'id
    //    du message (créé en 1) — si l'écriture échoue on supprime la ligne pour ne
    //    pas laisser une bulle "[message vocal]" sans média (orphelin non lisible).
    try {
      await saveAudioFromBase64(message.id, audioBase64);
    } catch (err) {
      await conversationRepository.deleteMessage(message.id).catch(() => {});
      throw err;
    }

    // 3) Pointe la mediaUrl vers l'endpoint de streaming.
    const updated = await conversationRepository.attachMedia(message.id, `/messages/${message.id}/audio`, "audio");

    // Le broadcast socket (effet de bord transport) est laissé au routeur pour garder
    // ce use-case pur — cohérent avec send-message.use-case.
    return { message: updated ?? message, participants: conversation.participants };
  };
};
