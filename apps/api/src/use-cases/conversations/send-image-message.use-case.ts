// Cas d'usage (couche conversations) : envoyer un message image.
// Écriture en trois temps avec compensation : créer la ligne de message, stocker les
// octets dans le bucket privé, puis rattacher la mediaUrl. Si l'une des deux dernières
// étapes échoue, on annule les précédentes (best-effort) pour ne jamais laisser une bulle
// "[image]" illisible ou un fichier orphelin.
import type { Message } from "../../entities/conversation.entity.js";
import type { IConversationRepository } from "../../repositories/Conversation/conversation.repository.js";
import { ImageAttachError } from "../../middleware/error-handler.js";
import { deleteMessageImage, saveMessageImage } from "../../services/media-storage.service.js";

/**
 * Factory du cas d'usage « envoyer un message image ».
 * @param conversationRepository repository des conversations
 * @returns une fonction (conversationId, senderId, image {octets + type MIME}) qui
 *   renvoie le message rattaché et la liste des participants, ou `null` si la
 *   conversation n'existe pas / l'expéditeur n'en est pas membre (→ 404 au routeur).
 *   Lève ImageAttachError (500 typé) si le média ne peut pas être rattaché.
 */
export const sendImageMessageUseCase = (conversationRepository: IConversationRepository) => {
  return async (
    conversationId: string,
    senderId: string,
    image: { bytes: Buffer; contentType: string },
  ): Promise<{ message: Message; participants: string[] } | null> => {
    const conversation = await conversationRepository.getConversationById(conversationId);
    // Introuvable et non-participant retombent tous deux sur un 404 côté routeur (on ne
    // divulgue pas l'existence d'une conversation dont l'appelant n'est pas membre).
    if (!conversation || !conversation.participants.includes(senderId)) return null;

    // 1) Crée le message (sans mediaUrl pour l'instant).
    const message = await conversationRepository.createMessage({
      conversationId,
      senderId,
      districtId: conversation.districtId,
      type: "image",
      content: "[image]",
    });

    // 2) Stocke les octets sous l'id du message dans le bucket privé des messages. Si
    //    l'écriture échoue, on supprime la ligne pour ne pas laisser de bulle "[image]"
    //    illisible.
    try {
      await saveMessageImage(message.id, image.bytes, image.contentType);
    } catch (err) {
      await conversationRepository.deleteMessage(message.id).catch(() => {});
      throw err;
    }

    // 3) Pointe la mediaUrl vers le flux protégé par vérification de participant (relatif,
    //    comme l'audio). Si l'update lève OU renvoie null (ligne absente), l'image est
    //    stockée mais le message n'a pas de mediaUrl → orphelin. On compense (suppression
    //    des octets + de la ligne, best-effort) et on remonte un 500 typé plutôt que de
    //    renvoyer une bulle "[image]" cassée.
    let updated: Message | null;
    try {
      updated = await conversationRepository.attachMedia(message.id, `/messages/${message.id}/image`, "image");
    } catch (err) {
      await deleteMessageImage(message.id);
      await conversationRepository.deleteMessage(message.id).catch(() => {});
      throw err;
    }
    if (!updated) {
      await deleteMessageImage(message.id);
      await conversationRepository.deleteMessage(message.id).catch(() => {});
      throw new ImageAttachError();
    }

    return { message: updated, participants: conversation.participants };
  };
};
