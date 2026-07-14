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
  SendVoiceMessageDtoSchema,
  SendImageMessageDtoSchema,
  UploadMediaDtoSchema,
  BadRequestErrorSchema,
  NotFoundErrorSchema,
  PaginatedResponseDtoSchema,
} from "./DTO";
import { auth } from "./auth-meta";

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
    metadata: auth({ audience: "api" }),
  },

  getConversationById: {
    method: "GET",
    path: "/conversations/:id",
    pathParams: ConversationParamsDtoSchema,
    responses: {
      200: ConversationResponseDtoSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Get a single conversation by ID (participant only)",
    metadata: auth({
      audience: "api",
      scope: {
        resource: "conversation",
        ownerArrayField: "participants",
        districtField: "districtId",
        notFoundOnDeny: true,
      },
    }),
  },

  createConversation: {
    method: "POST",
    path: "/conversations",
    body: CreateConversationDtoSchema,
    responses: {
      201: ConversationResponseDtoSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Create a new conversation",
    metadata: auth({ audience: "api" }),
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
    summary: "Get messages of a conversation (participant only)",
    metadata: auth({
      audience: "api",
      scope: {
        resource: "conversation",
        ownerArrayField: "participants",
        districtField: "districtId",
        notFoundOnDeny: true,
      },
    }),
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
    summary: "Send a message in a conversation (participant only)",
    metadata: auth({
      audience: "api",
      scope: {
        resource: "conversation",
        ownerArrayField: "participants",
        districtField: "districtId",
        notFoundOnDeny: true,
      },
    }),
  },

  sendVoiceMessage: {
    method: "POST",
    path: "/conversations/:id/messages/voice",
    pathParams: ConversationParamsDtoSchema,
    body: SendVoiceMessageDtoSchema,
    responses: {
      201: MessageResponseDtoSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Send a voice message in a conversation (participant only)",
    metadata: auth({
      audience: "api",
      scope: {
        resource: "conversation",
        ownerArrayField: "participants",
        districtField: "districtId",
        notFoundOnDeny: true,
      },
    }),
  },

  sendImageMessage: {
    method: "POST",
    path: "/conversations/:id/messages/image",
    pathParams: ConversationParamsDtoSchema,
    body: SendImageMessageDtoSchema,
    responses: {
      201: MessageResponseDtoSchema,
      400: BadRequestErrorSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Send an image message in a conversation (participant only)",
    metadata: auth({
      audience: "api",
      scope: {
        resource: "conversation",
        ownerArrayField: "participants",
        districtField: "districtId",
        notFoundOnDeny: true,
      },
    }),
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
    summary: "Mark a message as read (conversation participant only)",
    metadata: auth({
      audience: "api",
      scope: {
        resource: "messageParticipants",
        ownerArrayField: "participants",
        districtField: "districtId",
        notFoundOnDeny: true,
      },
    }),
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
    summary: "Attach media (photo/audio/file) to an existing message (sender only)",
    metadata: auth({
      audience: "api",
      scope: { resource: "message", ownerField: "senderId", districtField: "districtId", notFoundOnDeny: true },
    }),
  },
});
