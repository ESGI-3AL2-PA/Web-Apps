import type { EventResponseDto } from "@repo/contracts";
import api from "./api";

// GET /recommendations/events — events suggérés pour le user connecté
// (collaborative filtering via Neo4j, exclut ce qu'il a déjà engagé).
export async function getRecommendedEvents(limit = 10): Promise<EventResponseDto[]> {
  try {
    const res = await api.get<{ data: EventResponseDto[] }>("/recommendations/events", {
      params: { limit },
    });
    return res.data?.data ?? [];
  } catch {
    throw new Error("Erreur lors du chargement des suggestions");
  }
}
