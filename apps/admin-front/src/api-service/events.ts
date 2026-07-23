// Wrappers d'appels HTTP vers les endpoints /events (evenements) : CRUD complet.
import type { CreateEventDto, EventResponseDto, UpdateEventDto } from "@repo/contracts";
import api from "./api";
import type { ListParams, Paginated } from "./types";

/** Liste paginee des evenements. */
export async function listEvents(params: ListParams): Promise<Paginated<EventResponseDto>> {
  const res = await api.get<Paginated<EventResponseDto>>("/events", { params });
  return res.data;
}

/** Detail d'un evenement par son id. */
export async function getEvent(id: string): Promise<EventResponseDto> {
  const res = await api.get<EventResponseDto>(`/events/${id}`);
  return res.data;
}

/** Cree un evenement. */
export async function createEvent(body: CreateEventDto): Promise<EventResponseDto> {
  const res = await api.post<EventResponseDto>("/events", body);
  return res.data;
}

/** Met a jour partiellement un evenement (PATCH). */
export async function updateEvent(id: string, body: UpdateEventDto): Promise<EventResponseDto> {
  const res = await api.patch<EventResponseDto>(`/events/${id}`, body);
  return res.data;
}

/** Supprime un evenement par son id. */
export async function deleteEvent(id: string): Promise<void> {
  await api.delete(`/events/${id}`);
}
