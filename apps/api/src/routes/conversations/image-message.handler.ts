import type { Request, Response, NextFunction } from "express";
import { resolve } from "../../repositories/container.js";
import type { IConversationRepository } from "../../repositories/Conversation/conversation.repository.js";
import { getMessageImage } from "../../services/media-storage.service.js";

// GET /messages/:id/image — sert l'image d'un message (binaire). Auth + contrôle de
// participation, sur le même modèle que le flux audio. Privé (contrairement aux images
// d'annonces publiques) : une photo partagée dans une conversation n'est lisible que
// par les membres de cette conversation.
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

    // Seuls les participants de la conversation du message peuvent le lire (sinon 404,
    // pour ne pas révéler que le message existe).
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
