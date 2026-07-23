// Cas d'usage (couche conversations) : envoyer un message texte (ou déjà porteur d'une
// mediaUrl fournie par l'appelant). Reste un use-case pur — le broadcast socket est
// laissé au routeur.
import type { SendMessageDto } from "@repo/contracts";
import type { Message } from "../../entities/conversation.entity.js";
import type { IConversationRepository } from "../../repositories/Conversation/conversation.repository.js";

/**
 * Factory du cas d'usage « envoyer un message ».
 * @param conversationRepository repository des conversations
 * @returns une fonction (conversationId, senderId, data) qui persiste le message et
 *   renvoie ce message + la liste des participants, ou `null` si la conversation
 *   n'existe pas (→ 404 au routeur).
 */
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
