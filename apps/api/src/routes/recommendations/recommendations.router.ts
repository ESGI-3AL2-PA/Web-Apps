import { initServer } from "@ts-rest/express";
import { recommendationsContract } from "@repo/contracts";
import { resolve } from "../../repositories/container.js";
import { getEventRecommendationsUseCase } from "../../use-cases/recommendations/get-event-recommendations.use-case.js";

const s = initServer();

/**
 * Router ts-rest des recommandations.
 *
 * Couche router. Expose la recommandation d'événements personnalisés pour
 * l'appelant : le cas d'usage interroge la projection graphe (Neo4j) pour classer
 * les événements par affinité, puis hydrate les documents depuis le repository event.
 */
export const recommendationsRouter = s.router(recommendationsContract, {
  getEventRecommendations: async ({ query: { limit }, req }) => {
    // Recommandations calculées pour l'appelant (req.user.sub), plafonnées à `limit`.
    const events = await getEventRecommendationsUseCase(resolve("graph"), resolve("event"))(req.user!.sub, limit);
    return { status: 200, body: { data: events } };
  },
});
