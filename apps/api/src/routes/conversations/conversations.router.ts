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

export const conversationsRouter = s.router(conversationsContract, {
  getConversations: async ({ query }) => {
    const result = await getConversationsUseCase(resolve("conversation"))(query);
    return { status: 200, body: result };
  },

  getConversationById: async ({ params: { id } }) => {
    const conversation = await getConversationByIdUseCase(resolve("conversation"))({ id });
    if (!conversation) {
      return { status: 404, body: { message: "Conversation not found" } };
    }
    return { status: 200, body: conversation };
  },

  createConversation: async ({ body }) => {
    const conversation = await createConversationUseCase(resolve("conversation"))(body);
    return { status: 201, body: conversation };
  },

  getMessages: async ({ params: { id }, query: { page, limit } }) => {
    const conversation = await getConversationByIdUseCase(resolve("conversation"))({ id });
    if (!conversation) {
      return { status: 404, body: { message: "Conversation not found" } };
    }
    const result = await getMessagesUseCase(resolve("conversation"))(id, { page, limit });
    return { status: 200, body: result };
  },

  sendMessage: async ({ params: { id }, body }) => {
    const message = await sendMessageUseCase(resolve("conversation"))(id, body);
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
