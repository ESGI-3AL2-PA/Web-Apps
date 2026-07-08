import type { Event } from "../../entities/event.entity.js";
import type { IEventRepository } from "../../repositories/Event/event.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";

export const unregisterFromEventUseCase = (eventRepository: IEventRepository, graphRepository: IGraphRepository) => {
  return async (id: string, userId: string): Promise<Event | null> => {
    const event = await eventRepository.removeRegistrant(id, userId);
    if (event) {
      await syncGraph(`unlinkUserRegisteredForEvent(${userId}->${id})`, () =>
        graphRepository.unlinkUserRegisteredForEvent(userId, id),
      );
    }
    return event;
  };
};
