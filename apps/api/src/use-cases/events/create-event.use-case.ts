import type { CreateEventDto } from "@repo/contracts";
import type { Event } from "../../entities/event.entity.js";
import type { IEventRepository } from "../../repositories/Event/event.repository.js";

export const createEventUseCase = (eventRepository: IEventRepository) => {
  return async (data: CreateEventDto & { creatorId: string }): Promise<Event> => {
    return await eventRepository.createEvent({
      ...data,
      remainingSeats: data.totalSeats,
      status: "upcoming",
      registrants: [],
    });
  };
};
