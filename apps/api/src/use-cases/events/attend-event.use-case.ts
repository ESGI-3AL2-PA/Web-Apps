import type { Event } from "../../entities/event.entity.js";
import type { IEventRepository } from "../../repositories/Event/event.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";

export const attendEventUseCase = (eventRepository: IEventRepository, graphRepository: IGraphRepository) => {
  return async (id: string, userId: string, rating?: number): Promise<Event | null> => {
    const event = await eventRepository.getEventById(id);
    if (!event) return null;

    // Mongo is the source of truth; the Neo4j edge is a best-effort projection. Persist
    // durably first so attendance/rating isn't lost when the graph is unavailable.
    await eventRepository.recordAttendance(id, userId, rating);

    await syncGraph(`linkUserAttendedEvent(${userId}->${id})`, () =>
      graphRepository.linkUserAttendedEvent(userId, id, rating),
    );

    return event;
  };
};
