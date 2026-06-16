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

type PaginatedConversations = PaginatedResponseDto<typeof ConversationResponseDtoSchema>;
type PaginatedMessages = PaginatedResponseDto<typeof MessageResponseDtoSchema>;

// ── Conversations ────────────────────────────────────────────────────────────

export async function getConversations(
  _filters: ConversationQueryDto = {} as ConversationQueryDto,
): Promise<PaginatedConversations> {
  throw new Error("Not implemented");
}

export async function getConversationById(_id: string): Promise<ConversationResponseDto> {
  throw new Error("Not implemented");
}

export async function createConversation(_data: CreateConversationDto): Promise<ConversationResponseDto> {
  throw new Error("Not implemented");
}

// ── Messages (nested under a conversation, plus standalone actions) ──────────

export async function getMessages(
  _conversationId: string,
  _filters: MessageQueryDto = {} as MessageQueryDto,
): Promise<PaginatedMessages> {
  throw new Error("Not implemented");
}

export async function sendMessage(
  _conversationId: string,
  _data: SendMessageDto,
): Promise<MessageResponseDto> {
  throw new Error("Not implemented");
}

export async function markMessageRead(_messageId: string): Promise<MessageResponseDto> {
  throw new Error("Not implemented");
}

export async function attachMediaToMessage(
  _messageId: string,
  _data: UploadMediaDto,
): Promise<MessageResponseDto> {
  throw new Error("Not implemented");
}
