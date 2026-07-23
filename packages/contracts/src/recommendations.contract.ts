import { initContract } from "@ts-rest/core";

import { EventRecommendationsQueryDtoSchema, EventRecommendationsResponseDtoSchema } from "./DTO";
import { auth } from "./auth-meta";

const c = initContract();

/**
 * Contract ts-rest du moteur de recommandation.
 *
 * Pour l'instant un seul endpoint : suggestions d'événements basées sur le
 * graphe social Neo4j (filtrage collaboratif via les relations
 * INTERESTED_IN_EVENT alimentées par les signaux d'intérêt des utilisateurs).
 */
export const recommendationsContract = c.router({
  // GET /recommendations/events — recommandations d'événements personnalisées (filtrage collaboratif Neo4j).
  getEventRecommendations: {
    method: "GET",
    path: "/recommendations/events",
    query: EventRecommendationsQueryDtoSchema,
    responses: {
      200: EventRecommendationsResponseDtoSchema,
    },
    summary:
      "Get personalized event recommendations based on the user's interest signals (Neo4j collaborative filtering)",
    metadata: auth({ audience: "api" }),
  },
});
