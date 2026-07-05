import path from "path";
import fs from "fs";
import type { Request, Response, NextFunction } from "express";
import { resolve } from "../../repositories/container.js";
import { saveAudioFromBase64, buildAudioPath } from "../../services/media-storage.service.js";
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

    const repo = resolve("conversation");
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
      type: "audio",
      content: "[message vocal]",
    });

    // 2) Sauve l'audio sur disque sous storage/messages/{messageId}.webm
    await saveAudioFromBase64(message.id, audioBase64);

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

    const repo = resolve("conversation");
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

    const absolute = path.resolve(buildAudioPath(messageId));
    if (!fs.existsSync(absolute)) {
      res.status(404).json({ message: "Audio file missing" });
      return;
    }

    res.setHeader("Content-Type", "audio/webm");
    res.sendFile(absolute);
  } catch (err) {
    next(err);
  }
};
