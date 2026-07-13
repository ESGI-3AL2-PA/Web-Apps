import type { EventResponseDto } from "@repo/contracts";
import api from "./api";

// GET /recommendations/events — events suggested for the authed user (Neo4j
// collaborative filtering; excludes what they already engaged with).
export async function getRecommendedEvents(limit = 10): Promise<EventResponseDto[]> {
  const res = await api.get<{ data: EventResponseDto[] }>("/recommendations/events", { params: { limit } });
  return res.data?.data ?? [];
}
