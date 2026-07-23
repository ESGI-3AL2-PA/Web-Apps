/**
 * Service client des recommandations. S'appuie sur le moteur de filtrage collaboratif Neo4j
 * pour suggérer des événements pertinents à l'utilisateur.
 */
import type { EventResponseDto } from "@repo/contracts";
import api from "./api";

// GET /recommendations/events — événements suggérés pour l'utilisateur authentifié (filtrage
// collaboratif Neo4j ; exclut ceux avec lesquels il a déjà interagi).
export async function getRecommendedEvents(limit = 10): Promise<EventResponseDto[]> {
  const res = await api.get<{ data: EventResponseDto[] }>("/recommendations/events", { params: { limit } });
  return res.data?.data ?? [];
}
