// DTO (couche contracts) : schémas zod des recommandations d'événements.
// Expose la query (nombre max de suggestions) et la réponse (liste d'événements
// recommandés, déjà triée par pertinence côté serveur).
import { z } from "../zod";
import { EventResponseDtoSchema } from "./event.dto";

/** Query de la route de recommandations : un `limit` optionnel (1..50, défaut 10) qui borne le nombre de suggestions. */
export const EventRecommendationsQueryDtoSchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).optional().default(10),
  })
  .openapi({ title: "EventRecommendationsQuery" });
export type EventRecommendationsQueryDto = z.infer<typeof EventRecommendationsQueryDtoSchema>;

/** Réponse : la liste des événements recommandés, déjà ordonnée par pertinence. */
export const EventRecommendationsResponseDtoSchema = z
  .object({
    data: z.array(EventResponseDtoSchema),
  })
  .openapi({ title: "EventRecommendationsResponse" });
export type EventRecommendationsResponseDto = z.infer<typeof EventRecommendationsResponseDtoSchema>;
