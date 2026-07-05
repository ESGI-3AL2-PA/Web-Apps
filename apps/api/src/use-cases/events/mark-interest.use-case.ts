import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";

// Best-effort: a degraded Neo4j must not fail the user's 👍/👎.
export const markInterestUseCase = (graph: IGraphRepository) => {
  return async (userId: string, eventId: string, scoreDelta: number): Promise<void> => {
    try {
      await graph.linkUserInterestedInEvent(userId, eventId, scoreDelta);
    } catch (err) {
      console.error("[markInterest] Neo4j sync failed", err);
    }
  };
};
