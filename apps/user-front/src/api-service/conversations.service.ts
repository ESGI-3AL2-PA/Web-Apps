import type {
  ConversationQueryInput,
  ConversationResponseDto,
  ConversationResponseDtoSchema,
  CreateConversationDto,
  MessageQueryInput,
  MessageResponseDto,
  MessageResponseDtoSchema,
  PaginatedResponseDto,
  SendMessageDto,
} from "@repo/contracts";
import api from "./api";

// Convert a Blob → raw base64 (strips the `data:...;base64,` prefix).
const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).replace(/^data:[^;]+;base64,/, ""));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

// Convert a File → full base64 data-URL (keeps the `data:<mime>;base64,` prefix so the
// api can recover the content-type).
const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

type PaginatedConversations = PaginatedResponseDto<typeof ConversationResponseDtoSchema>;
type PaginatedMessages = PaginatedResponseDto<typeof MessageResponseDtoSchema>;

// GET /conversations — conversations the user participates in
export async function getConversations(filters: ConversationQueryInput = {}): Promise<ConversationResponseDto[]> {
  const res = await api.get<PaginatedConversations>("/conversations", {
    params: { ...filters, limit: filters.limit ?? 100 },
  });
  return res.data.data;
}

// POST /conversations — start (or the backend returns an existing direct) conversation
export async function createConversation(data: CreateConversationDto): Promise<ConversationResponseDto> {
  const res = await api.post<ConversationResponseDto>("/conversations", data);
  return res.data;
}

// GET /conversations/:id/messages — messages of a conversation (participant only)
export async function getMessages(
  conversationId: string,
  filters: MessageQueryInput = {},
): Promise<MessageResponseDto[]> {
  const res = await api.get<PaginatedMessages>(`/conversations/${conversationId}/messages`, { params: filters });
  // The API returns the most recent messages first; the thread reads oldest→newest top-to-bottom.
  return res.data.data.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// POST /conversations/:id/messages — send a text message
export async function sendMessage(conversationId: string, data: SendMessageDto): Promise<MessageResponseDto> {
  const res = await api.post<MessageResponseDto>(`/conversations/${conversationId}/messages`, data);
  return res.data;
}

// PATCH /messages/:id/read — mark a message read (no body).
export async function markMessageRead(messageId: string): Promise<MessageResponseDto> {
  const res = await api.patch<MessageResponseDto>(`/messages/${messageId}/read`);
  return res.data;
}

// POST /conversations/:id/messages/voice — send a voice note (Blob → base64).
export async function sendVoiceMessage(conversationId: string, audioBlob: Blob): Promise<MessageResponseDto> {
  const audioBase64 = await blobToBase64(audioBlob);
  const res = await api.post<MessageResponseDto>(`/conversations/${conversationId}/messages/voice`, { audioBase64 });
  return res.data;
}

// GET /messages/:id/audio — fetch a voice note's bytes (Bearer auto-attached).
export async function fetchAudioBlob(messageId: string): Promise<Blob> {
  const res = await api.get(`/messages/${messageId}/audio`, { responseType: "blob" });
  return new Blob([res.data], { type: "audio/webm" });
}

// POST /conversations/:id/messages/image — send an image message (File → base64
// data-URL). The bytes ride in-band, like a voice note (not the public /uploads route).
export async function sendImageMessage(conversationId: string, file: File): Promise<MessageResponseDto> {
  const imageBase64 = await fileToDataUrl(file);
  const res = await api.post<MessageResponseDto>(`/conversations/${conversationId}/messages/image`, { imageBase64 });
  return res.data;
}

// GET /messages/:id/image — fetch a message image's bytes (Bearer auto-attached).
// Participant-checked server-side, so images are fetched as a blob, not embedded by URL.
export async function fetchImageBlob(messageId: string): Promise<Blob> {
  const res = await api.get(`/messages/${messageId}/image`, { responseType: "blob" });
  return res.data as Blob;
}
