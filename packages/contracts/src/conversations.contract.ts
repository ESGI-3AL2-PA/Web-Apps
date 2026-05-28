import { initContract } from "@ts-rest/core";

import {
  ConversationParamsDtoSchema,
  ConversationQueryDtoSchema,
  ConversationResponseDtoSchema,
  CreateConversationDtoSchema,
  MessageParamsDtoSchema,
  MessageQueryDtoSchema,
  MessageResponseDtoSchema,
  SendMessageDtoSchema,
  UploadMediaDtoSchema,
  NotFoundErrorSchema,
  PaginatedResponseDtoSchema,
} from "./DTO";

const c = initContract();

export const conversationsContract = c.router({
  getConversations: {
    method: "GET",
    path: "/conversations",
    query: ConversationQueryDtoSchema,
    responses: {
      200: PaginatedResponseDtoSchema(ConversationResponseDtoSchema),
    },
    summary: "Get a paginated list of conversations",
  },

  getConversationById: {
    method: "GET",
    path: "/conversations/:id",
    pathParams: ConversationParamsDtoSchema,
    responses: {
      200: ConversationResponseDtoSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Get a single conversation by ID",
  },

  createConversation: {
    method: "POST",
    path: "/conversations",
    body: CreateConversationDtoSchema,
    responses: {
      201: ConversationResponseDtoSchema,
    },
    summary: "Create a new conversation",
  },

  getMessages: {
    method: "GET",
    path: "/conversations/:id/messages",
    pathParams: ConversationParamsDtoSchema,
    query: MessageQueryDtoSchema,
    responses: {
      200: PaginatedResponseDtoSchema(MessageResponseDtoSchema),
      404: NotFoundErrorSchema,
    },
    summary: "Get messages of a conversation",
  },

  sendMessage: {
    method: "POST",
    path: "/conversations/:id/messages",
    pathParams: ConversationParamsDtoSchema,
    body: SendMessageDtoSchema,
    responses: {
      201: MessageResponseDtoSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Send a message in a conversation",
  },

  markMessageRead: {
    method: "PATCH",
    path: "/messages/:id/read",
    pathParams: MessageParamsDtoSchema,
    body: c.noBody(),
    responses: {
      200: MessageResponseDtoSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Mark a message as read",
  },

  attachMedia: {
    method: "POST",
    path: "/messages/:id/media",
    pathParams: MessageParamsDtoSchema,
    body: UploadMediaDtoSchema,
    responses: {
      200: MessageResponseDtoSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Attach media (photo/audio/file) to an existing message",
  },
});
