import type {
  EventQueryDto,
  EventResponseDto,
  EventResponseDtoSchema,
  PaginatedResponseDto,
  UpdateEventDto,
} from "@repo/contracts";
import api from "./api";

type PaginatedEvents = PaginatedResponseDto<typeof EventResponseDtoSchema>;

// Consigne ADMIN — EVENTS:
//   - Read all (statistiques et modération)
//   - Update (modifier le statut)
//   - Delete (modération)
// (Pas de create / register / attend — réservés à l'user-front)

// GET /events — paginated list (admin: voit tout, pas de filtre creatorId)
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

// GET /events/:id
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

// PATCH /events/:id — modifier le statut (cancelled, completed, …)
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

// DELETE /events/:id — modération
export async function deleteEvent(id: string): Promise<void> {
  try {
    await api.delete(`/events/${id}`);
  } catch {
    throw new Error("Erreur lors de la suppression de l'événement");
  }
}
