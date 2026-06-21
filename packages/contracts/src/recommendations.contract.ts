import { initContract } from "@ts-rest/core";

import {
  EventRecommendationsQueryDtoSchema,
  EventRecommendationsResponseDtoSchema,
} from "./DTO";
import { auth } from "./auth-meta";

const c = initContract();

// Endpoint(s) du moteur de recommandation. Pour l'instant un seul :
// suggestions d'events basées sur le graphe social Neo4j (collaborative
// filtering via les relations INTERESTED_IN_EVENT).
export const recommendationsContract = c.router({
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
