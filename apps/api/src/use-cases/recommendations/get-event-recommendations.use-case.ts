// Cas d'usage : recommandations d'événements pour un utilisateur.
// Combine le graphe Neo4j (classement par affinité) et Mongo (documents complets).
import type { Event } from "../../entities/event.entity.js";
import type { IEventRepository } from "../../repositories/Event/event.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";

// Fenêtre pendant laquelle un événement passé est encore considéré « en cours ».
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

/**
 * Recalcule le statut d'un événement à partir de sa date, comme get-events.use-case,
 * pour que les recommandations affichent un statut cohérent avec le reste de l'app.
 * Un événement « cancelled » (annulé) le reste ; une date invalide retombe sur le statut stocké.
 */
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

/**
 * Factory du cas d'usage de recommandation d'événements.
 * Pipeline : (1) Neo4j renvoie des IDs classés par affinité, (2) fetch groupé Mongo,
 * (3) re-tri dans l'ordre Neo4j + recalcul du statut + filtrage des événements
 * passés/annulés. Renvoie au plus `limit` événements « upcoming » ou « ongoing ».
 * @param graph repository graphe (Neo4j) pour le classement par affinité
 * @param eventRepo repository Mongo des événements
 */
export const getEventRecommendationsUseCase = (graph: IGraphRepository, eventRepo: IEventRepository) => {
  return async (userId: string, limit = 10): Promise<Event[]> => {
    // 1. Demande à Neo4j la liste ordonnée d'IDs d'events pertinents.
    const ids = await graph.getRecommendedEventIds(userId, limit);
    if (ids.length === 0) return [];

    // 2. Récupère les docs Mongo en un seul fetch.
    const events = await eventRepo.getEventsByIds(ids);

    // 3. Re-tri pour préserver l'ordre Neo4j (le `find($in)` ne le garantit pas)
    //    + recompute du statut.
    const byId = new Map(events.map((e) => [e.id, e]));
    return (
      ids
        .map((id) => byId.get(id))
        .filter((e): e is Event => Boolean(e))
        .map((e) => ({ ...e, status: computeStatus(e.eventDate, e.status) }))
        // Le graphe classe par affinité sans filtrer la date : on écarte les
        // events passés/annulés pour ne suggérer que ce à quoi l'user peut encore participer.
        .filter((e) => e.status === "upcoming" || e.status === "ongoing")
    );
  };
};
