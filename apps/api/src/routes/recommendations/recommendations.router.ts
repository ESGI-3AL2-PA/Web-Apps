import { initServer } from "@ts-rest/express";
import { recommendationsContract } from "@repo/contracts";
import { resolve } from "../../repositories/container.js";
import { getEventRecommendationsUseCase } from "../../use-cases/recommendations/get-event-recommendations.use-case.js";

const s = initServer();

export const recommendationsRouter = s.router(recommendationsContract, {
  getEventRecommendations: async ({ query: { limit }, req }) => {
    const events = await getEventRecommendationsUseCase(resolve("graph"), resolve("event"))(req.user!.sub, limit);
    return { status: 200, body: { data: events } };
  },
});
