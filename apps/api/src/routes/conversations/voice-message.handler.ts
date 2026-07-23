import type { Request, Response, NextFunction } from "express";
import { resolve } from "../../repositories/container.js";
import type { IConversationRepository } from "../../repositories/Conversation/conversation.repository.js";
import { getAudioStream, AUDIO_MIME } from "../../services/media-storage.service.js";

// GET /messages/:id/audio — sert le fichier audio (binaire). Auth + contrôle de
// participation. Le POST du message vocal est une route de contrat ts-rest
// (conversationsRouter) ; seul ce flux binaire reste un handler brut, comme les flux
// image d'annonce et PDF de contrat.
export const audioStreamHandler = async (req: Request, res: Response, next: NextFunction) => {
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

    // Vérifie que l'user est participant de la conversation
    const conv = await repo.getConversationById(message.conversationId);
    if (!conv || !conv.participants.includes(user.sub)) {
      res.status(404).json({ message: "Message not found" });
      return;
    }

    const stream = await getAudioStream(messageId);
    if (!stream) {
      res.status(404).json({ message: "Audio file missing" });
      return;
    }

    res.setHeader("Content-Type", AUDIO_MIME);
    stream.on("error", (err) => next(err));
    stream.pipe(res);
  } catch (err) {
    next(err);
  }
};
