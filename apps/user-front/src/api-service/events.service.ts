import type {
  AttendEventDto,
  CreateEventDto,
  EventQueryDto,
  EventResponseDto,
  EventResponseDtoSchema,
  PaginatedResponseDto,
  UpdateEventDto,
} from "@repo/contracts";
import api from "./api";

type PaginatedEvents = PaginatedResponseDto<typeof EventResponseDtoSchema>;

export async function getEvents(filters: EventQueryDto = {} as EventQueryDto): Promise<PaginatedEvents> {
  try {
    const res = await api.get<PaginatedEvents>("/events", { params: filters });
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Erreur lors du get all events");
  }
}

export async function getEventById(id: string): Promise<EventResponseDto> {
  try {
    const res = await api.get<EventResponseDto>(`/events/${id}`);
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Événement introuvable");
  }
}

export async function createEvent(data: CreateEventDto): Promise<EventResponseDto> {
  try {
    const res = await api.post<EventResponseDto>("/events", data);
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Erreur lors de la création de l'événement");
  }
}

export async function registerToEvent(id: string): Promise<EventResponseDto> {
  try {
    const res = await api.post<EventResponseDto>(`/events/${id}/register`);
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Erreur lors de l'inscription à l'événement");
  }
}

export async function attendEvent(id: string, data: AttendEventDto): Promise<EventResponseDto> {
  try {
    const res = await api.post<EventResponseDto>(`/events/${id}/attend`, data);
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Erreur lors de l'enregistrement de présence");
  }
}

export async function updateEvent(id: string, data: UpdateEventDto): Promise<EventResponseDto> {
  try {
    const res = await api.patch<EventResponseDto>(`/events/${id}`, data);
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Erreur lors de la mise à jour de l'événement");
  }
}

export async function deleteEvent(id: string): Promise<void> {
  try {
    await api.delete(`/events/${id}`);
  } catch {
    throw new Error("Erreur lors de la suppression de l'événement");
  }
}

export async function unregisterFromEvent(id: string): Promise<EventResponseDto> {
  try {
    const res = await api.delete<EventResponseDto>(`/events/${id}/register`);
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Erreur lors de la désinscription de l'événement");
  }
}

export async function markEventInterest(id: string, rating: number): Promise<void> {
  try {
    await api.post(`/events/${id}/interest`, { rating });
  } catch {
    throw new Error("Erreur lors de l'enregistrement de votre préférence");
  }
}
