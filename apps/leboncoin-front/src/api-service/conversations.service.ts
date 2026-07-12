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
} from "@repo/contracts";
import api from "./api";

type PaginatedConversations = PaginatedResponseDto<typeof ConversationResponseDtoSchema>;
type PaginatedMessages = PaginatedResponseDto<typeof MessageResponseDtoSchema>;

// GET /conversations — conversations the user participates in
export async function getConversations(
  filters: ConversationQueryDto = {} as ConversationQueryDto,
): Promise<ConversationResponseDto[]> {
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
  filters: MessageQueryDto = {} as MessageQueryDto,
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
