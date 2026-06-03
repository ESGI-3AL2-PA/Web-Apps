import { initServer } from "@ts-rest/express";
import { conversationsContract } from "@repo/contracts";
import { resolve } from "../../repositories/container.js";
import { getConversationsUseCase } from "../../use-cases/conversations/get-conversations.use-case.js";
import { getConversationByIdUseCase } from "../../use-cases/conversations/get-conversation-by-id.use-case.js";
import { createConversationUseCase } from "../../use-cases/conversations/create-conversation.use-case.js";
import { getMessagesUseCase } from "../../use-cases/conversations/get-messages.use-case.js";
import { sendMessageUseCase } from "../../use-cases/conversations/send-message.use-case.js";
import { markMessageReadUseCase } from "../../use-cases/conversations/mark-message-read.use-case.js";
import { attachMediaUseCase } from "../../use-cases/conversations/attach-media.use-case.js";

const s = initServer();

// Participant/sender authorization for the record-level routes below is enforced by
// the contract-metadata middleware (404-on-deny).
export const conversationsRouter = s.router(conversationsContract, {
  getConversations: async ({ query, req }) => {
    // Users only see their own conversations; admins may filter freely.
    const isAdmin = req.user!.role === "admin";
    const scoped = isAdmin ? query : { ...query, participantId: req.user!.sub };
    const result = await getConversationsUseCase(resolve("conversation"))(scoped);
    return { status: 200, body: result };
  },

  getConversationById: async ({ params: { id } }) => {
    const conversation = await getConversationByIdUseCase(resolve("conversation"))({ id });
    if (!conversation) {
      return { status: 404, body: { message: "Conversation not found" } };
    }
    return { status: 200, body: conversation };
  },

  createConversation: async ({ body, req }) => {
    // The creator is always a participant; never trust the list alone.
    const participants = Array.from(new Set([req.user!.sub, ...body.participants]));
    const conversation = await createConversationUseCase(resolve("conversation"))({ ...body, participants });
    return { status: 201, body: conversation };
  },

  getMessages: async ({ params: { id }, query: { page, limit } }) => {
    const result = await getMessagesUseCase(resolve("conversation"))(id, { page, limit });
    return { status: 200, body: result };
  },

  sendMessage: async ({ params: { id }, body, req }) => {
    const message = await sendMessageUseCase(resolve("conversation"))(id, req.user!.sub, body);
    if (!message) {
      return { status: 404, body: { message: "Conversation not found" } };
    }
    return { status: 201, body: message };
  },

  markMessageRead: async ({ params: { id } }) => {
    const message = await markMessageReadUseCase(resolve("conversation"))(id);
    if (!message) {
      return { status: 404, body: { message: "Message not found" } };
    }
    return { status: 200, body: message };
  },

  attachMedia: async ({ params: { id }, body }) => {
    const message = await attachMediaUseCase(resolve("conversation"))(id, body);
    if (!message) {
      return { status: 404, body: { message: "Message not found" } };
    }
    return { status: 200, body: message };
  },
});
