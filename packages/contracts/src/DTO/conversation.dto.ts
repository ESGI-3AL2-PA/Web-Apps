// DTO zod de la messagerie : conversations (directes ou de groupe, cloisonnées par
// quartier) et messages (texte / image / audio / fichier), avec les envois média en base64.
import { z } from "../zod";

/** Type de conversation : à deux (direct) ou de groupe. */
export const ConversationTypeSchema = z.enum(["direct", "group"]);
export type ConversationType = z.infer<typeof ConversationTypeSchema>;

/** Nature d'un message et donc du contenu porté. */
export const MessageTypeSchema = z.enum(["text", "image", "audio", "file"]);
export type MessageType = z.infer<typeof MessageTypeSchema>;

/** Conversation renvoyée au client : participants, quartier partagé, dernier message. */
export const ConversationResponseDtoSchema = z
  .object({
    id: z.string().openapi({ description: "Unique conversation identifier" }),
    participants: z.array(z.string()).openapi({ description: "IDs of the participants" }),
    districtId: z.string().openapi({ description: "District shared by all participants" }),
    type: ConversationTypeSchema.openapi({ description: "direct or group" }),
    name: z.string().optional().openapi({ description: "Name (mostly for group conversations)" }),
    lastMessageAt: z.string().datetime().optional().openapi({ description: "Timestamp of the last message" }),
    createdAt: z.string().datetime(),
  })
  .openapi({ title: "ConversationResponse" });
export type ConversationResponseDto = z.infer<typeof ConversationResponseDtoSchema>;

// Création d'une conversation : au moins 2 participants requis.
export const CreateConversationDtoSchema = z
  .object({
    participants: z.array(z.string()).min(2).openapi({ description: "IDs of the participants" }),
    type: ConversationTypeSchema,
    name: z.string().optional(),
  })
  .openapi({ title: "CreateConversation" });
export type CreateConversationDto = z.infer<typeof CreateConversationDtoSchema>;

export const ConversationParamsDtoSchema = z.object({ id: z.string() }).openapi({ title: "ConversationParams" });
export type ConversationParamsDto = z.infer<typeof ConversationParamsDtoSchema>;

// Query de listing des conversations : pagination + filtres participant / quartier.
export const ConversationQueryDtoSchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    participantId: z.string().optional(),
    districtId: z.string().optional(),
  })
  .openapi({ title: "ConversationQuery" });
export type ConversationQueryDto = z.infer<typeof ConversationQueryDtoSchema>;
export type ConversationQueryInput = z.input<typeof ConversationQueryDtoSchema>;

// Message renvoyé au client : émetteur, contenu (ou légende), média éventuel, statut lu.
export const MessageResponseDtoSchema = z
  .object({
    id: z.string(),
    senderId: z.string(),
    conversationId: z.string(),
    districtId: z.string(),
    type: MessageTypeSchema,
    content: z.string().openapi({ description: "Text content (or caption for media)" }),
    mediaUrl: z.string().optional().openapi({ description: "Media URL when type is image/audio/file" }),
    read: z.boolean(),
    createdAt: z.string().datetime(),
  })
  .openapi({ title: "MessageResponse" });
export type MessageResponseDto = z.infer<typeof MessageResponseDtoSchema>;

// Envoi d'un message : par défaut texte ; mediaUrl requis (URL) pour les types média.
export const SendMessageDtoSchema = z
  .object({
    type: MessageTypeSchema.default("text"),
    content: z.string().min(1),
    mediaUrl: z.string().url().optional(),
  })
  .openapi({ title: "SendMessage" });
export type SendMessageDto = z.infer<typeof SendMessageDtoSchema>;

export const MessageParamsDtoSchema = z.object({ id: z.string() }).openapi({ title: "MessageParams" });
export type MessageParamsDto = z.infer<typeof MessageParamsDtoSchema>;

// Envoi d'une note vocale : base64 (data-URL ou brut). Borné à ~5 Mo décodés —
// le base64 gonfle d'environ 4/3, donc 7M caractères ≈ 5 Mo — pour ne pas saturer
// le stockage objet.
export const SendVoiceMessageDtoSchema = z
  .object({
    audioBase64: z
      .string()
      .min(20)
      .max(7_000_000)
      .openapi({ description: "Voice clip as base64 (data-URL or raw), max ~5 MB decoded" }),
  })
  .openapi({ title: "SendVoiceMessage" });
export type SendVoiceMessageDto = z.infer<typeof SendVoiceMessageDtoSchema>;

// Envoi d'une image : data-URL base64 (png/jpeg/webp/gif). Même borne ~5 Mo que la voix.
// Servie en privé (contrôle des participants), contrairement aux images publiques d'annonces.
export const SendImageMessageDtoSchema = z
  .object({
    imageBase64: z
      .string()
      .min(20)
      .max(7_000_000)
      .openapi({ description: "Image as a base64 data-URL (png/jpeg/webp/gif), max ~5 MB decoded" }),
  })
  .openapi({ title: "SendImageMessage" });
export type SendImageMessageDto = z.infer<typeof SendImageMessageDtoSchema>;

// Query de listing des messages d'une conversation : pagination (jusqu'à 200 par page).
export const MessageQueryDtoSchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  })
  .openapi({ title: "MessageQuery" });
export type MessageQueryDto = z.infer<typeof MessageQueryDtoSchema>;
export type MessageQueryInput = z.input<typeof MessageQueryDtoSchema>;

// Rattachement d'un média déjà téléversé : URL fournie par le service d'upload + son type.
export const UploadMediaDtoSchema = z
  .object({
    mediaUrl: z.string().url().openapi({ description: "URL of the uploaded media (provided by upload service)" }),
    type: MessageTypeSchema,
  })
  .openapi({ title: "UploadMedia" });
export type UploadMediaDto = z.infer<typeof UploadMediaDtoSchema>;
