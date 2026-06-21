import type { Event, EventStatus } from "../../entities/event.entity.js";
import type { IEventRepository } from "../../repositories/Event/event.repository.js";

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

// Recalcule dynamiquement le statut à partir de `eventDate`. `cancelled` reste
// un flag explicite stocké en DB (jamais réécrit). Ainsi un event créé il y a
// 6 mois pour le 1er janvier passé apparaît comme "completed" sans qu'aucun
// cron ne le mette à jour.
const computeStatus = (eventDate: string, storedStatus: string): EventStatus => {
  if (storedStatus === "cancelled") return "cancelled";
  const t = new Date(eventDate).getTime();
  if (Number.isNaN(t)) return storedStatus as EventStatus;
  const now = Date.now();
  if (t > now) return "upcoming";
  if (t > now - FOUR_HOURS_MS) return "ongoing";
  return "completed";
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
    // Override `status` sur chaque event renvoyé pour refléter l'état réel.
    const data: Event[] = result.data.map((e) => ({
      ...e,
      status: computeStatus(e.eventDate, e.status),
    }));
    return { ...result, data };
  };
};
