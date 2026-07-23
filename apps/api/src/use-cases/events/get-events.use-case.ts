import type { Event, EventStatus } from "../../entities/event.entity.js";
import type { IEventRepository } from "../../repositories/Event/event.repository.js";

/**
 * Cas d'usage : liste paginée d'événements avec statut dérivé.
 * Couche use-case (apps/api). Récupère les événements via le repository (filtres : recherche,
 * statut, quartier, créateur, inscrit, pagination) puis recalcule leur statut à la volée à partir
 * de la date, sans dépendre d'un cron.
 */

// Fenêtre pendant laquelle un événement est considéré "en cours" après son heure de début.
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

// Dérive le statut depuis `eventDate` pour qu'il transitionne sans cron. `cancelled` est un
// drapeau stocké explicite et n'est jamais écrasé.
const computeStatus = (eventDate: string, storedStatus: string): EventStatus => {
  if (storedStatus === "cancelled") return "cancelled";
  const t = new Date(eventDate).getTime();
  // Date invalide : on conserve le statut stocké tel quel.
  if (Number.isNaN(t)) return storedStatus as EventStatus;
  const now = Date.now();
  if (t > now) return "upcoming"; // à venir
  if (t > now - FOUR_HOURS_MS) return "ongoing"; // en cours (dans les 4h suivant le début)
  return "completed"; // terminé
};

export const getEventsUseCase = (eventRepository: IEventRepository) => {
  return async (params: {
    search?: string;
    status?: string;
    districtId?: string;
    creatorId?: string;
    registrantId?: string;
    page?: number;
    limit?: number;
  }) => {
    const result = await eventRepository.getEvents(params);
    // Recalcule le statut de chaque événement sans altérer le reste de la réponse paginée.
    const data: Event[] = result.data.map((e) => ({
      ...e,
      status: computeStatus(e.eventDate, e.status),
    }));
    return { ...result, data };
  };
};
