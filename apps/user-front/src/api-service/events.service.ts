import type {
  CreateEventDto,
  EventQueryInput,
  EventResponseDto,
  EventResponseDtoSchema,
  MarkInterestDto,
  PaginatedResponseDto,
} from "@repo/contracts";
import api from "./api";

/**
 * Service client des événements de quartier : listing, création, inscription et signal de
 * goût. Ce dernier (👍/👎) alimente le moteur de recommandation Neo4j.
 */
type PaginatedEvents = PaginatedResponseDto<typeof EventResponseDtoSchema>;

// GET /events — événements de la communauté, restreints au quartier.
export async function getEvents(filters: EventQueryInput = {}): Promise<EventResponseDto[]> {
  const res = await api.get<PaginatedEvents>("/events", { params: { ...filters, limit: filters.limit ?? 50 } });
  return res.data.data;
}

// POST /events — crée un événement de communauté dans le quartier de l'appelant.
export async function createEvent(body: CreateEventDto): Promise<EventResponseDto> {
  const res = await api.post<EventResponseDto>("/events", body);
  return res.data;
}

// POST /events/:id/register — prend une place.
export async function registerToEvent(id: string): Promise<EventResponseDto> {
  const res = await api.post<EventResponseDto>(`/events/${id}/register`);
  return res.data;
}

// DELETE /events/:id/register — libère la place.
export async function unregisterFromEvent(id: string): Promise<EventResponseDto> {
  const res = await api.delete<EventResponseDto>(`/events/${id}/register`);
  return res.data;
}

// POST /events/:id/interest — signal de goût 👍/👎 qui alimente le moteur de reco Neo4j.
export async function markInterest(id: string, rating: MarkInterestDto["rating"]): Promise<void> {
  await api.post(`/events/${id}/interest`, { rating });
}
