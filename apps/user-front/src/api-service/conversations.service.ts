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

/**
 * Service client de la messagerie (conversations et messages). Couvre le texte, les notes
 * vocales et les images : ces deux derniers transitent en base64 « in-band » dans le corps
 * JSON (et non via la route publique /uploads), car l'accès aux médias est vérifié côté
 * serveur au niveau du participant. Les octets sont donc récupérés en blob, jamais embarqués
 * par URL. Le fichier expose aussi les helpers d'encodage base64.
 */

// Convertit un Blob → base64 brut (retire le préfixe `data:...;base64,`).
const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).replace(/^data:[^;]+;base64,/, ""));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

// Convertit un File → data-URL base64 complète (conserve le préfixe `data:<mime>;base64,`
// pour que l'api puisse retrouver le content-type).
const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

type PaginatedConversations = PaginatedResponseDto<typeof ConversationResponseDtoSchema>;
type PaginatedMessages = PaginatedResponseDto<typeof MessageResponseDtoSchema>;

// GET /conversations — conversations auxquelles l'utilisateur participe.
export async function getConversations(filters: ConversationQueryInput = {}): Promise<ConversationResponseDto[]> {
  const res = await api.get<PaginatedConversations>("/conversations", {
    params: { ...filters, limit: filters.limit ?? 100 },
  });
  return res.data.data;
}

// POST /conversations — démarre une conversation (ou le backend renvoie la conversation directe existante).
export async function createConversation(data: CreateConversationDto): Promise<ConversationResponseDto> {
  const res = await api.post<ConversationResponseDto>("/conversations", data);
  return res.data;
}

// GET /conversations/:id/messages — messages d'une conversation (participant uniquement).
export async function getMessages(
  conversationId: string,
  filters: MessageQueryInput = {},
): Promise<MessageResponseDto[]> {
  const res = await api.get<PaginatedMessages>(`/conversations/${conversationId}/messages`, { params: filters });
  // L'API renvoie les messages les plus récents en premier ; le fil se lit du plus ancien au
  // plus récent de haut en bas, d'où le tri croissant par createdAt.
  return res.data.data.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// POST /conversations/:id/messages — envoie un message texte.
export async function sendMessage(conversationId: string, data: SendMessageDto): Promise<MessageResponseDto> {
  const res = await api.post<MessageResponseDto>(`/conversations/${conversationId}/messages`, data);
  return res.data;
}

// PATCH /messages/:id/read — marque un message comme lu (sans corps).
export async function markMessageRead(messageId: string): Promise<MessageResponseDto> {
  const res = await api.patch<MessageResponseDto>(`/messages/${messageId}/read`);
  return res.data;
}

// POST /conversations/:id/messages/voice — envoie une note vocale (Blob → base64).
export async function sendVoiceMessage(conversationId: string, audioBlob: Blob): Promise<MessageResponseDto> {
  const audioBase64 = await blobToBase64(audioBlob);
  const res = await api.post<MessageResponseDto>(`/conversations/${conversationId}/messages/voice`, { audioBase64 });
  return res.data;
}

// GET /messages/:id/audio — récupère les octets d'une note vocale (Bearer attaché automatiquement).
export async function fetchAudioBlob(messageId: string): Promise<Blob> {
  const res = await api.get(`/messages/${messageId}/audio`, { responseType: "blob" });
  return new Blob([res.data], { type: "audio/webm" });
}

// POST /conversations/:id/messages/image — envoie une image (File → data-URL base64). Les octets
// transitent in-band, comme une note vocale (pas via la route publique /uploads).
export async function sendImageMessage(conversationId: string, file: File): Promise<MessageResponseDto> {
  const imageBase64 = await fileToDataUrl(file);
  const res = await api.post<MessageResponseDto>(`/conversations/${conversationId}/messages/image`, { imageBase64 });
  return res.data;
}

// GET /messages/:id/image — récupère les octets de l'image d'un message (Bearer attaché automatiquement).
// Vérifié au niveau participant côté serveur : les images sont récupérées en blob, non embarquées par URL.
export async function fetchImageBlob(messageId: string): Promise<Blob> {
  const res = await api.get(`/messages/${messageId}/image`, { responseType: "blob" });
  return res.data as Blob;
}
