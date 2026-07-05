import type { Event } from "../../entities/event.entity.js";
import type { IEventRepository } from "../../repositories/Event/event.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";

export const registerToEventUseCase = (
  eventRepository: IEventRepository,
  graphRepository: IGraphRepository,
) => {
  return async (id: string, userId: string): Promise<Event | null> => {
    const event = await eventRepository.addRegistrant(id, userId);
    if (event) {
      const now = new Date().toISOString();
      await syncGraph(`linkUserRegisteredForEvent(${userId}->${id})`, () =>
        graphRepository.linkUserRegisteredForEvent(userId, id, now, "registered"),
      );
    }
    return event;
  };
};
