import type { Request, Response, NextFunction } from "express";
import { resolve } from "../../repositories/container.js";
import type { IConversationRepository } from "../../repositories/Conversation/conversation.repository.js";
import { getMessageImage } from "../../services/media-storage.service.js";

// GET /messages/:id/image — serves a message's image (binary). Auth + participant
// check, mirroring the audio stream. Private (unlike public listing images) so a
// photo shared in a conversation is only readable by that conversation's members.
export const imageMessageStreamHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const { id: messageId } = req.params;
    if (!messageId) {
      res.status(400).json({ message: "Missing message id" });
      return;
    }

    const repo: IConversationRepository = resolve("conversation");
    const message = await repo.getMessageById(messageId);
    if (!message) {
      res.status(404).json({ message: "Message not found" });
      return;
    }

    // Only participants of the message's conversation may read it (404 otherwise,
    // so we don't reveal that the message exists).
    const conv = await repo.getConversationById(message.conversationId);
    if (!conv || !conv.participants.includes(user.sub)) {
      res.status(404).json({ message: "Message not found" });
      return;
    }

    const image = await getMessageImage(messageId);
    if (!image) {
      res.status(404).json({ message: "Image file missing" });
      return;
    }

    res.setHeader("Content-Type", image.contentType);
    image.stream.on("error", (err) => next(err));
    image.stream.pipe(res);
  } catch (err) {
    next(err);
  }
};
