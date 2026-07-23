import { initServer } from "@ts-rest/express";
import { conversationsContract } from "@repo/contracts";
import { resolve } from "../../repositories/container.js";
import type { IUserRepository } from "../../repositories/User/user.repository.js";
import { getConversationsUseCase } from "../../use-cases/conversations/get-conversations.use-case.js";
import { getConversationByIdUseCase } from "../../use-cases/conversations/get-conversation-by-id.use-case.js";
import { createConversationUseCase } from "../../use-cases/conversations/create-conversation.use-case.js";
import { getMessagesUseCase } from "../../use-cases/conversations/get-messages.use-case.js";
import { sendMessageUseCase } from "../../use-cases/conversations/send-message.use-case.js";
import { sendVoiceMessageUseCase } from "../../use-cases/conversations/send-voice-message.use-case.js";
import { sendImageMessageUseCase } from "../../use-cases/conversations/send-image-message.use-case.js";
import { decodeImageBase64 } from "../../services/image-storage.service.js";
import { markMessageReadUseCase } from "../../use-cases/conversations/mark-message-read.use-case.js";
import { attachMediaUseCase } from "../../use-cases/conversations/attach-media.use-case.js";
import { broadcastNewMessage } from "../../sockets/io.js";

const s = initServer();

/**
 * Router ts-rest des conversations (messagerie privée entre résidents d'un quartier :
 * messages texte, vocaux et images, avec diffusion temps réel via socket.io).
 * L'autorisation participant/expéditeur des routes au niveau enregistrement ci-dessous
 * est assurée par le middleware contract-metadata (404 en cas de refus).
 */
export const conversationsRouter = s.router(conversationsContract, {
  // GET /conversations — liste les conversations de l'appelant.
  getConversations: async ({ query, req }) => {
    // Les conversations sont privées à leurs participants — chaque rôle (y compris
    // admin/superAdmin) ne liste que les conversations auxquelles il prend part. Les
    // routes détail et messages appliquent le même contrôle de participation, si bien
    // que la liste et le détail concordent (plus de "listé mais 404 à l'ouverture"
    // pour un personnel non participant).
    const result = await getConversationsUseCase(resolve("conversation"))({
      ...query,
      participantId: req.user!.sub,
    });
    return { status: 200, body: result };
  },

  // GET /conversations/:id — détail d'une conversation.
  getConversationById: async ({ params: { id } }) => {
    const conversation = await getConversationByIdUseCase(resolve("conversation"))({ id });
    if (!conversation) {
      return { status: 404, body: { message: "Conversation not found" } };
    }
    return { status: 200, body: conversation };
  },

  // POST /conversations — crée une conversation.
  createConversation: async ({ body, req }) => {
    // Le créateur est toujours participant ; ne jamais se fier à la seule liste fournie.
    const participants = Array.from(new Set([req.user!.sub, ...body.participants]));
    // Une conversation appartient à un seul quartier : on le dérive du créateur,
    // jamais du client.
    const userRepo: IUserRepository = resolve("user");
    const me = await userRepo.getUserById(req.user!.sub);
    if (!me) {
      return { status: 404, body: { message: "User not found" } };
    }
    const conversation = await createConversationUseCase(resolve("conversation"))({
      ...body,
      participants,
      districtId: me.districtId,
    });
    return { status: 201, body: conversation };
  },

  // GET /conversations/:id/messages — messages paginés d'une conversation.
  getMessages: async ({ params: { id }, query: { page, limit } }) => {
    const result = await getMessagesUseCase(resolve("conversation"))(id, { page, limit });
    return { status: 200, body: result };
  },

  // POST /conversations/:id/messages — envoie un message texte.
  sendMessage: async ({ params: { id }, body, req }) => {
    const result = await sendMessageUseCase(resolve("conversation"))(id, req.user!.sub, body);
    if (!result) {
      return { status: 404, body: { message: "Conversation not found" } };
    }
    // Push aux autres participants connectés (eux refetcheront automatiquement).
    broadcastNewMessage(result.participants, result.message);
    return { status: 201, body: result.message };
  },

  // POST /conversations/:id/voice — envoie un message vocal (audio en base64).
  sendVoiceMessage: async ({ params: { id }, body, req }) => {
    const result = await sendVoiceMessageUseCase(resolve("conversation"))(id, req.user!.sub, body.audioBase64);
    if (!result) {
      return { status: 404, body: { message: "Conversation not found" } };
    }
    broadcastNewMessage(result.participants, result.message);
    return { status: 201, body: result.message };
  },

  // POST /conversations/:id/image — envoie un message image (data-URL base64).
  sendImageMessage: async ({ params: { id }, body, req }) => {
    // Décode/valide le format avant stockage ; 400 si le format n'est pas supporté.
    const decoded = decodeImageBase64(body.imageBase64);
    if (!decoded) {
      return { status: 400, body: { message: "Unsupported image format (png, jpeg, webp, gif)" } };
    }
    const result = await sendImageMessageUseCase(resolve("conversation"))(id, req.user!.sub, decoded);
    if (!result) {
      return { status: 404, body: { message: "Conversation not found" } };
    }
    broadcastNewMessage(result.participants, result.message);
    return { status: 201, body: result.message };
  },

  // POST /messages/:id/read — marque un message comme lu.
  markMessageRead: async ({ params: { id } }) => {
    const message = await markMessageReadUseCase(resolve("conversation"))(id);
    if (!message) {
      return { status: 404, body: { message: "Message not found" } };
    }
    return { status: 200, body: message };
  },

  // POST /messages/:id/media — rattache une pièce jointe média à un message.
  attachMedia: async ({ params: { id }, body }) => {
    const message = await attachMediaUseCase(resolve("conversation"))(id, body);
    if (!message) {
      return { status: 404, body: { message: "Message not found" } };
    }
    return { status: 200, body: message };
  },
});
