import axios from "axios";
import { isTokenExpiringSoon } from "@repo/hooks";
import { config } from "@repo/config";
import type {
  ContractQueryDto,
  ContractResponseDto,
  ConversationResponseDto,
  CreateListingDto,
  EventQueryDto,
  EventResponseDto,
  ListingQueryDto,
  ListingResponseDto,
  MessageResponseDto,
  NotificationResponseDto,
  TransactionQueryDto,
  TransactionResponseDto,
  VoteQueryDto,
  VoteResponseDto,
} from "@repo/contracts";

type Paginated<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
};

type PaginatedListingsResponse = Paginated<ListingResponseDto>;

const AUTH_SERVICE_URL = config.authServiceUrl;
const API_BASE_URL = config.apiUrl;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  // Serialise array params as repeated keys (`tags=a&tags=b`) rather than `tags[]=a`.
  paramsSerializer: { indexes: null },
});

let getAccessToken: (() => string | null) | null = null;
let refreshFn: (() => Promise<string | null>) | null = null;

export function setupInterceptors(tokenGetter: () => string | null, refresher: () => Promise<string | null>) {
  getAccessToken = tokenGetter;
  refreshFn = refresher;
}

// Proactively refresh token before it expires, then attach Bearer header
let refreshPromise: Promise<string | null> | null = null;

api.interceptors.request.use(async (config) => {
  const token = getAccessToken?.();

  if (token && isTokenExpiringSoon(token, 60) && refreshFn) {
    if (!refreshPromise) {
      refreshPromise = refreshFn().finally(() => {
        refreshPromise = null;
      });
    }
    await refreshPromise;
  }

  const currentToken = getAccessToken?.();
  if (currentToken) {
    config.headers.Authorization = `Bearer ${currentToken}`;
  }
  return config;
});

// On 401, attempt refresh and retry once
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry && refreshFn) {
      original._retry = true;
      const newToken = await refreshFn();
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
      // Refresh failed — redirect to login
      window.location.href = `${AUTH_SERVICE_URL}/login?redirect_uri=${encodeURIComponent(window.location.href)}`;
    }
    return Promise.reject(error);
  },
);

export async function getListings(query: Partial<ListingQueryDto> = {}): Promise<PaginatedListingsResponse> {
  const res = await api.get<PaginatedListingsResponse>("/listings", { params: query });
  return res.data;
}

export async function createListing(body: CreateListingDto): Promise<ListingResponseDto> {
  const res = await api.post<ListingResponseDto>("/listings", body);
  return res.data;
}

export async function deleteListing(id: string): Promise<void> {
  await api.delete(`/listings/${id}`);
}

export async function getUserTransactions(
  userId: string,
  query: Partial<TransactionQueryDto> = {},
): Promise<Paginated<TransactionResponseDto>> {
  const res = await api.get<Paginated<TransactionResponseDto>>(`/users/${userId}/transactions`, { params: query });
  return res.data;
}

export async function getNotifications(
  query: { page?: number; limit?: number; read?: boolean } = {},
): Promise<Paginated<NotificationResponseDto>> {
  const res = await api.get<Paginated<NotificationResponseDto>>("/notifications", { params: query });
  return res.data;
}

export async function markNotificationRead(id: string): Promise<void> {
  await api.patch(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.patch("/notifications/read-all");
}

export async function deleteNotification(id: string): Promise<void> {
  await api.delete(`/notifications/${id}`);
}

export async function getContracts(query: Partial<ContractQueryDto> = {}): Promise<Paginated<ContractResponseDto>> {
  const res = await api.get<Paginated<ContractResponseDto>>("/contracts", { params: query });
  return res.data;
}

export async function disputeContract(id: string, reason: string): Promise<ContractResponseDto> {
  const res = await api.post<ContractResponseDto>(`/contracts/${id}/dispute`, { reason });
  return res.data;
}

export async function getConversations(): Promise<Paginated<ConversationResponseDto>> {
  const res = await api.get<Paginated<ConversationResponseDto>>("/conversations", { params: { limit: 100 } });
  return res.data;
}

export async function getMessages(conversationId: string): Promise<Paginated<MessageResponseDto>> {
  const res = await api.get<Paginated<MessageResponseDto>>(`/conversations/${conversationId}/messages`, {
    params: { limit: 200 },
  });
  return res.data;
}

export async function sendMessage(conversationId: string, content: string): Promise<MessageResponseDto> {
  const res = await api.post<MessageResponseDto>(`/conversations/${conversationId}/messages`, {
    type: "text",
    content,
  });
  return res.data;
}

export async function getEvents(query: Partial<EventQueryDto> = {}): Promise<Paginated<EventResponseDto>> {
  const res = await api.get<Paginated<EventResponseDto>>("/events", { params: query });
  return res.data;
}

export async function registerToEvent(id: string): Promise<EventResponseDto> {
  const res = await api.post<EventResponseDto>(`/events/${id}/register`);
  return res.data;
}

export async function unregisterFromEvent(id: string): Promise<EventResponseDto> {
  const res = await api.delete<EventResponseDto>(`/events/${id}/register`);
  return res.data;
}

export async function getVotes(query: Partial<VoteQueryDto> = {}): Promise<Paginated<VoteResponseDto>> {
  const res = await api.get<Paginated<VoteResponseDto>>("/votes", { params: query });
  return res.data;
}

export async function submitVoteResponse(id: string, chosenOption: string): Promise<VoteResponseDto> {
  const res = await api.post<VoteResponseDto>(`/votes/${id}/responses`, { chosenOption });
  return res.data;
}

export default api;
