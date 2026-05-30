import type { Event } from "../../entities/event.entity.js";
import type { IEventRepository } from "../../repositories/Event/event.repository.js";

export const updateEventUseCase = (eventRepository: IEventRepository) => {
  return async (id: string, data: Partial<Omit<Event, "id" | "createdAt">>): Promise<Event | null> => {
    return await eventRepository.updateEvent(id, data);
  };
};
