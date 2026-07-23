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

// Contrat ts-rest de la messagerie (api) : conversations et messages (texte, vocal,
// image, pièces jointes, accusés de lecture). Toutes les routes exigent audience
// "api". Note de sécurité (security-M2) : les écritures sont réservées aux
// participants — pas de `districtField` sur les écritures, pour qu'un admin de
// quartier non participant ne puisse pas injecter ou muter le contenu d'un échange privé.
export const conversationsContract = c.router({
  // GET /conversations — authentifié. Liste paginée des conversations.
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

  // GET /conversations/:id — participant uniquement. 404 (au lieu de 403) si refusé.
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

  // POST /conversations — authentifié. Crée une nouvelle conversation.
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

  // GET /conversations/:id/messages — participant uniquement. Liste paginée des
  // messages ; 404 si refusé.
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

  // POST /conversations/:id/messages — participant uniquement. Envoie un message texte.
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
    // security-M2 : écritures réservées aux participants. Pas de districtField — un
    // admin de quartier non participant ne doit pas pouvoir injecter de messages dans
    // une conversation privée.
    metadata: auth({
      audience: "api",
      scope: {
        resource: "conversation",
        ownerArrayField: "participants",
        notFoundOnDeny: true,
      },
    }),
  },

  // POST /conversations/:id/messages/voice — participant uniquement. Envoie un message
  // vocal.
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
    // security-M2 : écritures réservées aux participants (voir sendMessage).
    metadata: auth({
      audience: "api",
      scope: {
        resource: "conversation",
        ownerArrayField: "participants",
        notFoundOnDeny: true,
      },
    }),
  },

  // POST /conversations/:id/messages/image — participant uniquement. Envoie un message
  // image ; 400 si l'image est invalide.
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
    // security-M2 : écritures réservées aux participants (voir sendMessage).
    metadata: auth({
      audience: "api",
      scope: {
        resource: "conversation",
        ownerArrayField: "participants",
        notFoundOnDeny: true,
      },
    }),
  },

  // PATCH /messages/:id/read — participant uniquement. Marque un message comme lu.
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
    // security-M2 : les accusés de lecture sont réservés aux participants. Pas de
    // districtField — un admin de quartier qui modère une conversation ne doit pas
    // muter son état de lecture.
    metadata: auth({
      audience: "api",
      scope: {
        resource: "messageParticipants",
        ownerArrayField: "participants",
        notFoundOnDeny: true,
      },
    }),
  },

  // POST /messages/:id/media — expéditeur uniquement. Attache un média (photo/audio/
  // fichier) à un message existant.
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
    // suite de security-M2 : l'ajout de média est réservé à l'expéditeur. Pas de
    // districtField — un admin de quartier qui n'est pas l'expéditeur ne doit pas
    // pouvoir attacher un média à un message privé.
    metadata: auth({
      audience: "api",
      scope: { resource: "message", ownerField: "senderId", notFoundOnDeny: true },
    }),
  },
});
