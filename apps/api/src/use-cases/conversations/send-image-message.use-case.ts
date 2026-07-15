import type { Message } from "../../entities/conversation.entity.js";
import type { IConversationRepository } from "../../repositories/Conversation/conversation.repository.js";
import { ImageAttachError } from "../../middleware/error-handler.js";
import { deleteMessageImage, saveMessageImage } from "../../services/media-storage.service.js";

export const sendImageMessageUseCase = (conversationRepository: IConversationRepository) => {
  return async (
    conversationId: string,
    senderId: string,
    image: { bytes: Buffer; contentType: string },
  ): Promise<{ message: Message; participants: string[] } | null> => {
    const conversation = await conversationRepository.getConversationById(conversationId);
    // Not-found and non-participant both fall through to 404 at the router (we don't
    // disclose the existence of a conversation the caller isn't a member of).
    if (!conversation || !conversation.participants.includes(senderId)) return null;

    // 1) Create the message (no mediaUrl yet).
    const message = await conversationRepository.createMessage({
      conversationId,
      senderId,
      districtId: conversation.districtId,
      type: "image",
      content: "[image]",
    });

    // 2) Store the bytes under the message id in the private messages bucket. If the
    //    write fails, delete the row so we don't leave an unreadable "[image]" bubble.
    try {
      await saveMessageImage(message.id, image.bytes, image.contentType);
    } catch (err) {
      await conversationRepository.deleteMessage(message.id).catch(() => {});
      throw err;
    }

    // 3) Point mediaUrl at the participant-checked stream (relative, like audio). If
    //    attach throws OR reports no row, the image is stored but the message has no
    //    mediaUrl — an orphan. Compensate (delete bytes + row, best-effort) and surface
    //    a typed 500 rather than returning a broken "[image]" bubble.
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
