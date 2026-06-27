import type {
  ConversationQueryDto,
  ConversationResponseDto,
  ConversationResponseDtoSchema,
  CreateConversationDto,
  MessageQueryDto,
  MessageResponseDto,
  MessageResponseDtoSchema,
  PaginatedResponseDto,
  SendMessageDto,
  UploadMediaDto,
} from "@repo/contracts";
import api from "./api";

type PaginatedConversations = PaginatedResponseDto<typeof ConversationResponseDtoSchema>;
type PaginatedMessages = PaginatedResponseDto<typeof MessageResponseDtoSchema>;

// ── Conversations ────────────────────────────────────────────────────────────

// GET /conversations — paginated list of conversations the user participates in
export async function getConversations(
  filters: ConversationQueryDto = {} as ConversationQueryDto,
): Promise<PaginatedConversations> {
  try {
    const res = await api.get<PaginatedConversations>("/conversations", { params: filters });
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Erreur lors du get all conversations");
  }
}

// GET /conversations/:id — participant only (`authorize` middleware)
export async function getConversationById(id: string): Promise<ConversationResponseDto> {
  try {
    const res = await api.get<ConversationResponseDto>(`/conversations/${id}`);
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Conversation introuvable");
  }
}

// POST /conversations — démarrer une nouvelle conversation
export async function createConversation(
  data: CreateConversationDto,
): Promise<ConversationResponseDto> {
  try {
    const res = await api.post<ConversationResponseDto>("/conversations", data);
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Erreur lors de la création de la conversation");
  }
}

// ── Messages (nested under a conversation, plus standalone actions) ──────────

// GET /conversations/:id/messages — messages of a conversation (participant only)
export async function getMessages(
  conversationId: string,
  filters: MessageQueryDto = {} as MessageQueryDto,
): Promise<PaginatedMessages> {
  try {
    const res = await api.get<PaginatedMessages>(`/conversations/${conversationId}/messages`, {
      params: filters,
    });
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Erreur lors du chargement des messages");
  }
}

// POST /conversations/:id/messages — envoyer un message (participant only)
export async function sendMessage(
  conversationId: string,
  data: SendMessageDto,
): Promise<MessageResponseDto> {
  try {
    const res = await api.post<MessageResponseDto>(
      `/conversations/${conversationId}/messages`,
      data,
    );
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Erreur lors de l'envoi du message");
  }
}

// PATCH /messages/:id/read — marquer un message comme lu (no body)
export async function markMessageRead(messageId: string): Promise<MessageResponseDto> {
  try {
    const res = await api.patch<MessageResponseDto>(`/messages/${messageId}/read`);
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Erreur lors du marquage du message comme lu");
  }
}

// POST /messages/:id/media — attacher une photo/audio/fichier (sender only)
export async function attachMediaToMessage(
  messageId: string,
  data: UploadMediaDto,
): Promise<MessageResponseDto> {
  try {
    const res = await api.post<MessageResponseDto>(`/messages/${messageId}/media`, data);
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Erreur lors de l'ajout du média");
  }
}

// Convertit un Blob → base64 brut (sans data-URL prefix)
const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.replace(/^data:[^;]+;base64,/, ""));
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

// POST /conversations/:id/messages/voice — envoie un message vocal
export async function sendVoiceMessage(
  conversationId: string,
  audioBlob: Blob,
): Promise<MessageResponseDto> {
  try {
    const audioBase64 = await blobToBase64(audioBlob);
    const res = await api.post<MessageResponseDto>(
      `/conversations/${conversationId}/messages/voice`,
      { audioBase64 },
    );
    if (!res.data) throw new Error();
    return res.data;
  } catch {
    throw new Error("Erreur lors de l'envoi du message vocal");
  }
}

// Récupère un fichier audio en blob (axios attache le Bearer automatiquement)
export async function fetchAudioBlob(messageId: string): Promise<Blob> {
  try {
    const res = await api.get(`/messages/${messageId}/audio`, { responseType: "blob" });
    return new Blob([res.data], { type: "audio/webm" });
  } catch {
    throw new Error("Impossible de charger l'audio");
  }
}
