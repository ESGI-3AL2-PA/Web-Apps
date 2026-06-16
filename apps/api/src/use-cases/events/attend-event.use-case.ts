import type { Event } from "../../entities/event.entity.js";
import type { IEventRepository } from "../../repositories/Event/event.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";

export const attendEventUseCase = (
  eventRepository: IEventRepository,
  graphRepository: IGraphRepository,
) => {
  return async (id: string, userId: string, rating?: number): Promise<Event | null> => {
    // The attendance + rating fact lives in Neo4j (User-[:ATTENDED {rating}]->Event).
    // Mongo only needs to confirm the event exists.
    const event = await eventRepository.getEventById(id);
    if (!event) return null;

    await syncGraph(`linkUserAttendedEvent(${userId}->${id})`, () =>
      graphRepository.linkUserAttendedEvent(userId, id, rating),
    );

    return event;
  };
};
