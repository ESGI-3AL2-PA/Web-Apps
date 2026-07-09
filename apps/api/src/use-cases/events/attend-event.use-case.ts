import type { Event } from "../../entities/event.entity.js";
import type { IEventRepository } from "../../repositories/Event/event.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";

export const attendEventUseCase = (eventRepository: IEventRepository, graphRepository: IGraphRepository) => {
  return async (id: string, userId: string, rating?: number): Promise<Event | null> => {
    // Attendance + rating lives in Neo4j; Mongo only confirms the event exists.
    const event = await eventRepository.getEventById(id);
    if (!event) return null;

    await syncGraph(`linkUserAttendedEvent(${userId}->${id})`, () =>
      graphRepository.linkUserAttendedEvent(userId, id, rating),
    );

    return event;
  };
};
