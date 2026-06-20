import type {
  AttendEventDto,
  CreateEventDto,
  EventQueryDto,
  EventResponseDto,
  EventResponseDtoSchema,
  PaginatedResponseDto,
  RegisterEventDto,
  UpdateEventDto,
} from "@repo/contracts";
import api from "./api";

type PaginatedEvents = PaginatedResponseDto<typeof EventResponseDtoSchema>;

// GET /events — paginated list with optional filters
// (search, status, districtId, creatorId, page, limit)
export async function getEvents(
  filters: EventQueryDto = {} as EventQueryDto,
): Promise<PaginatedEvents> {
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

// GET /events/:id — single event
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

// POST /events — create a new event (creatorId resolved server-side from auth)
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

// POST /events/:id/register — current user joins the event
export async function registerToEvent(
  id: string,
  data: RegisterEventDto = {} as RegisterEventDto,
): Promise<EventResponseDto> {
  try {
    const res = await api.post<EventResponseDto>(`/events/${id}/register`, data);
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Erreur lors de l'inscription à l'événement");
  }
}

// POST /events/:id/attend — mark attendance + optionally rate the event
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

// PATCH /events/:id
export async function updateEvent(_id: string, _data: UpdateEventDto): Promise<EventResponseDto> {
  throw new Error("Not implemented");
}

// DELETE /events/:id
export async function deleteEvent(_id: string): Promise<void> {
  throw new Error("Not implemented");
}

// DELETE /events/:id/register
export async function unregisterFromEvent(
  _id: string,
  _data: RegisterEventDto,
): Promise<EventResponseDto> {
  throw new Error("Not implemented");
}
