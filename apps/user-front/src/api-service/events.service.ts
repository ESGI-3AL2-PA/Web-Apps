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

type PaginatedEvents = PaginatedResponseDto<typeof EventResponseDtoSchema>;

export async function getEvents(_filters: EventQueryDto = {} as EventQueryDto): Promise<PaginatedEvents> {
  throw new Error("Not implemented");
}

export async function getEventById(_id: string): Promise<EventResponseDto> {
  throw new Error("Not implemented");
}

export async function createEvent(_data: CreateEventDto): Promise<EventResponseDto> {
  throw new Error("Not implemented");
}

export async function updateEvent(_id: string, _data: UpdateEventDto): Promise<EventResponseDto> {
  throw new Error("Not implemented");
}

export async function deleteEvent(_id: string): Promise<void> {
  throw new Error("Not implemented");
}

export async function registerToEvent(_id: string, _data: RegisterEventDto): Promise<EventResponseDto> {
  throw new Error("Not implemented");
}

export async function unregisterFromEvent(_id: string, _data: RegisterEventDto): Promise<EventResponseDto> {
  throw new Error("Not implemented");
}

export async function attendEvent(_id: string, _data: AttendEventDto): Promise<EventResponseDto> {
  throw new Error("Not implemented");
}
