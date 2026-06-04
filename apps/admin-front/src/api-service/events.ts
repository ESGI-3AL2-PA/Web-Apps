import type { EventResponseDto } from "@repo/contracts";
import api from "./api";
import type { ListParams, Paginated } from "./types";

export async function listEvents(params: ListParams): Promise<Paginated<EventResponseDto>> {
  const res = await api.get<Paginated<EventResponseDto>>("/events", { params });
  return res.data;
}

export async function getEvent(id: string): Promise<EventResponseDto> {
  const res = await api.get<EventResponseDto>(`/events/${id}`);
  return res.data;
}

export async function deleteEvent(id: string): Promise<void> {
  await api.delete(`/events/${id}`);
}
