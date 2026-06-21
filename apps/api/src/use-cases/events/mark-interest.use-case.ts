import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";

// Alimente Neo4j en signaux d'intérêt pour la reco. Best-effort : on ne
// bloque pas l'action si Neo4j est dégradé (l'enregistrement est silently
// ignored, le user reverra son 👍/👎 fonctionnel côté UI).
export const markInterestUseCase = (graph: IGraphRepository) => {
  return async (userId: string, eventId: string, scoreDelta: number): Promise<void> => {
    try {
      await graph.linkUserInterestedInEvent(userId, eventId, scoreDelta);
    } catch (err) {
      console.error("[markInterest] Neo4j sync failed", err);
    }
  };
};
