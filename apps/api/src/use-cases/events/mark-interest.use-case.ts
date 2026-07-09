import type { IEventRepository } from "../../repositories/Event/event.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";

// Records a 👍/👎 interest signal. Returns false when the event doesn't exist so the
// route can 404 instead of writing a dangling edge to a phantom Event node. The graph
// write itself is best-effort (a degraded Neo4j must not fail the user's action).
export const markInterestUseCase = (eventRepository: IEventRepository, graphRepository: IGraphRepository) => {
  return async (userId: string, eventId: string, scoreDelta: number): Promise<boolean> => {
    const event = await eventRepository.getEventById(eventId);
    if (!event) return false;

    // Mongo is the source of truth; the Neo4j edge is a best-effort projection. Persist
    // durably first so the interest signal isn't lost when the graph is unavailable.
    await eventRepository.recordInterest(eventId, userId, scoreDelta);

    await syncGraph(`linkUserInterestedInEvent(${userId}->${eventId})`, () =>
      graphRepository.linkUserInterestedInEvent(userId, eventId, scoreDelta),
    );
    return true;
  };
};
