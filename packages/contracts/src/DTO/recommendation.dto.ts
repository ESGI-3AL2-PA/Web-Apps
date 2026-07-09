import { z } from "../zod";
import { EventResponseDtoSchema } from "./event.dto";

// Query : juste un `limit` optionnel pour borner le nombre de suggestions.
export const EventRecommendationsQueryDtoSchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).optional().default(10),
  })
  .openapi({ title: "EventRecommendationsQuery" });
export type EventRecommendationsQueryDto = z.infer<typeof EventRecommendationsQueryDtoSchema>;

// Réponse : la liste des events recommandés, déjà ordonnée par pertinence.
export const EventRecommendationsResponseDtoSchema = z
  .object({
    data: z.array(EventResponseDtoSchema),
  })
  .openapi({ title: "EventRecommendationsResponse" });
export type EventRecommendationsResponseDto = z.infer<typeof EventRecommendationsResponseDtoSchema>;
