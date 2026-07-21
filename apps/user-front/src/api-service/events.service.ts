import type {
  CreateEventDto,
  EventQueryInput,
  EventResponseDto,
  EventResponseDtoSchema,
  PaginatedResponseDto,
} from "@repo/contracts";
import api from "./api";

type PaginatedEvents = PaginatedResponseDto<typeof EventResponseDtoSchema>;

// GET /events — community events, district-scoped
export async function getEvents(filters: EventQueryInput = {}): Promise<EventResponseDto[]> {
  const res = await api.get<PaginatedEvents>("/events", { params: { ...filters, limit: filters.limit ?? 50 } });
  return res.data.data;
}

// POST /events — create a community event in the caller's district
export async function createEvent(body: CreateEventDto): Promise<EventResponseDto> {
  const res = await api.post<EventResponseDto>("/events", body);
  return res.data;
}

// POST /events/:id/register — take a seat
export async function registerToEvent(id: string): Promise<EventResponseDto> {
  const res = await api.post<EventResponseDto>(`/events/${id}/register`);
  return res.data;
}

// DELETE /events/:id/register — give the seat back
export async function unregisterFromEvent(id: string): Promise<EventResponseDto> {
  const res = await api.delete<EventResponseDto>(`/events/${id}/register`);
  return res.data;
}
