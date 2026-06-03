import { initServer } from "@ts-rest/express";
import { conversationsContract } from "@repo/contracts";
import { resolve } from "../../repositories/container.js";
import type { IConversationRepository } from "../../repositories/Conversation/conversation.repository.js";
import { getConversationsUseCase } from "../../use-cases/conversations/get-conversations.use-case.js";
import { getConversationByIdUseCase } from "../../use-cases/conversations/get-conversation-by-id.use-case.js";
import { createConversationUseCase } from "../../use-cases/conversations/create-conversation.use-case.js";
import { getMessagesUseCase } from "../../use-cases/conversations/get-messages.use-case.js";
import { sendMessageUseCase } from "../../use-cases/conversations/send-message.use-case.js";
import { markMessageReadUseCase } from "../../use-cases/conversations/mark-message-read.use-case.js";
import { attachMediaUseCase } from "../../use-cases/conversations/attach-media.use-case.js";

const s = initServer();

export const conversationsRouter = s.router(conversationsContract, {
  getConversations: async ({ query, req }) => {
    // Users only see their own conversations; admins may filter freely.
    const isAdmin = req.user!.role === "admin";
    const scoped = isAdmin ? query : { ...query, participantId: req.user!.sub };
    const result = await getConversationsUseCase(resolve("conversation"))(scoped);
    return { status: 200, body: result };
  },

  getConversationById: async ({ params: { id }, req }) => {
    const conversation = await getConversationByIdUseCase(resolve("conversation"))({ id });
    // Non-members are told it doesn't exist (don't leak conversation existence).
    if (!conversation || !conversation.participants.includes(req.user!.sub)) {
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

  getMessages: async ({ params: { id }, query: { page, limit }, req }) => {
    const conversation = await getConversationByIdUseCase(resolve("conversation"))({ id });
    if (!conversation || !conversation.participants.includes(req.user!.sub)) {
      return { status: 404, body: { message: "Conversation not found" } };
    }
    const result = await getMessagesUseCase(resolve("conversation"))(id, { page, limit });
    return { status: 200, body: result };
  },

  sendMessage: async ({ params: { id }, body, req }) => {
    const conversation = await getConversationByIdUseCase(resolve("conversation"))({ id });
    if (!conversation || !conversation.participants.includes(req.user!.sub)) {
      return { status: 404, body: { message: "Conversation not found" } };
    }
    const message = await sendMessageUseCase(resolve("conversation"))(id, req.user!.sub, body);
    if (!message) {
      return { status: 404, body: { message: "Conversation not found" } };
    }
    return { status: 201, body: message };
  },

  markMessageRead: async ({ params: { id }, req }) => {
    const repo: IConversationRepository = resolve("conversation");
    const existing = await repo.getMessageById(id);
    if (!existing) {
      return { status: 404, body: { message: "Message not found" } };
    }
    const conversation = await repo.getConversationById(existing.conversationId);
    if (!conversation || !conversation.participants.includes(req.user!.sub)) {
      return { status: 404, body: { message: "Message not found" } };
    }
    const message = await markMessageReadUseCase(repo)(id);
    if (!message) {
      return { status: 404, body: { message: "Message not found" } };
    }
    return { status: 200, body: message };
  },

  attachMedia: async ({ params: { id }, body, req }) => {
    const repo: IConversationRepository = resolve("conversation");
    const existing = await repo.getMessageById(id);
    // Only the message's own sender may attach media to it.
    if (!existing || existing.senderId !== req.user!.sub) {
      return { status: 404, body: { message: "Message not found" } };
    }
    const message = await attachMediaUseCase(repo)(id, body);
    if (!message) {
      return { status: 404, body: { message: "Message not found" } };
    }
    return { status: 200, body: message };
  },
});
