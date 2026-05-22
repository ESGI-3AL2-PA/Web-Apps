import type { Event } from "../../entities/event.entity.js";
import type { IEventRepository } from "../../repositories/Event/event.repository.js";

export const registerToEventUseCase = (eventRepository: IEventRepository) => {
  return async (id: string, userId: string): Promise<Event | null> => {
    return await eventRepository.addRegistrant(id, userId);
  };
};
