import { z } from "../zod";

export const ConversationTypeSchema = z.enum(["direct", "group"]);
export type ConversationType = z.infer<typeof ConversationTypeSchema>;

export const MessageTypeSchema = z.enum(["text", "image", "audio", "file"]);
export type MessageType = z.infer<typeof MessageTypeSchema>;

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

export const ConversationQueryDtoSchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    participantId: z.string().optional(),
    districtId: z.string().optional(),
  })
  .openapi({ title: "ConversationQuery" });
export type ConversationQueryDto = z.infer<typeof ConversationQueryDtoSchema>;

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

// Voice note upload: base64 (data-URL or raw). Bounded to ~5 MB decoded — base64
// inflates ~4/3, so 7M chars ≈ 5 MB — to guard against filling object storage.
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

// Image message upload: base64 data-URL (png/jpeg/webp/gif). Same ~5 MB bound as voice.
// Served privately (participant-checked), unlike public listing images.
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

export const MessageQueryDtoSchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  })
  .openapi({ title: "MessageQuery" });
export type MessageQueryDto = z.infer<typeof MessageQueryDtoSchema>;

export const UploadMediaDtoSchema = z
  .object({
    mediaUrl: z.string().url().openapi({ description: "URL of the uploaded media (provided by upload service)" }),
    type: MessageTypeSchema,
  })
  .openapi({ title: "UploadMedia" });
export type UploadMediaDto = z.infer<typeof UploadMediaDtoSchema>;
