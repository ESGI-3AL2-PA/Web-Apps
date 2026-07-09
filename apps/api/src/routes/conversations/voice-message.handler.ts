import type { Request, Response, NextFunction } from "express";
import { resolve } from "../../repositories/container.js";
import type { IConversationRepository } from "../../repositories/Conversation/conversation.repository.js";

// ~5 Mo décodés. base64 gonfle d'environ 4/3, donc 5 Mo ≈ 6.7M caractères.
const MAX_AUDIO_BASE64_LENGTH = 7_000_000;
import { saveAudioFromBase64, getAudioStream, AUDIO_MIME } from "../../services/media-storage.service.js";
import { broadcastNewMessage } from "../../sockets/io.js";

// POST /conversations/:id/messages/voice — body JSON { audioBase64: string }
export const voiceMessageHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const { id: conversationId } = req.params;
    const { audioBase64 } = req.body ?? {};
    if (!conversationId || typeof audioBase64 !== "string" || audioBase64.length < 20) {
      res.status(400).json({ message: "audioBase64 manquant" });
      return;
    }
    // Borne la taille pour éviter un remplissage disque (~5 Mo décodés ≈ 6.7M chars base64).
    if (audioBase64.length > MAX_AUDIO_BASE64_LENGTH) {
      res.status(413).json({ message: "Message vocal trop volumineux (max ~5 Mo)" });
      return;
    }

    const repo: IConversationRepository = resolve("conversation");
    const conversation = await repo.getConversationById(conversationId);
    if (!conversation) {
      res.status(404).json({ message: "Conversation not found" });
      return;
    }
    if (!conversation.participants.includes(user.sub)) {
      res.status(404).json({ message: "Conversation not found" });
      return;
    }

    // 1) Crée le message en DB (sans mediaUrl pour l'instant).
    const message = await repo.createMessage({
      conversationId,
      senderId: user.sub,
      districtId: conversation.districtId,
      type: "audio",
      content: "[message vocal]",
    });

    // 2) Sauve l'audio sur disque sous storage/messages/{messageId}.webm.
    //    Le nom de fichier dépend de l'id du message (créé en 1), donc si l'écriture
    //    échoue on supprime la ligne pour ne pas laisser une bulle "[message vocal]"
    //    sans média (orphelin non lisible).
    try {
      await saveAudioFromBase64(message.id, audioBase64);
    } catch (err) {
      await repo.deleteMessage(message.id).catch(() => {});
      throw err;
    }

    // 3) Met à jour la mediaUrl du message → endpoint streaming.
    const updated = await repo.attachMedia(message.id, `/messages/${message.id}/audio`, "audio");

    // 4) Push aux autres participants
    if (updated) broadcastNewMessage(conversation.participants, updated);

    res.status(201).json(updated ?? message);
  } catch (err) {
    next(err);
  }
};

// GET /messages/:id/audio — sert le fichier audio (binaire). Auth + party check.
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
