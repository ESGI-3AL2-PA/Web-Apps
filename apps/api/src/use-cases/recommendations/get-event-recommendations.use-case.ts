import type { Event } from "../../entities/event.entity.js";
import type { IEventRepository } from "../../repositories/Event/event.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

// Même logique que dans get-events.use-case : on recalcule le statut à partir
// de eventDate pour que les recommandations affichent un statut cohérent.
const computeStatus = (eventDate: string, storedStatus: string): Event["status"] => {
  if (storedStatus === "cancelled") return "cancelled";
  const t = new Date(eventDate).getTime();
  if (Number.isNaN(t)) return storedStatus as Event["status"];
  const now = Date.now();
  if (t > now) return "upcoming";
  if (t > now - FOUR_HOURS_MS) return "ongoing";
  return "completed";
};

export const getEventRecommendationsUseCase = (
  graph: IGraphRepository,
  eventRepo: IEventRepository,
) => {
  return async (userId: string, limit = 10): Promise<Event[]> => {
    // 1. Demande à Neo4j la liste ordonnée d'IDs d'events pertinents.
    const ids = await graph.getRecommendedEventIds(userId, limit);
    if (ids.length === 0) return [];

    // 2. Récupère les docs Mongo en un seul fetch.
    const events = await eventRepo.getEventsByIds(ids);

    // 3. Re-tri pour préserver l'ordre Neo4j (le `find($in)` ne le garantit pas)
    //    + recompute du statut.
    const byId = new Map(events.map((e) => [e.id, e]));
    return ids
      .map((id) => byId.get(id))
      .filter((e): e is Event => Boolean(e))
      .map((e) => ({ ...e, status: computeStatus(e.eventDate, e.status) }));
  };
};
