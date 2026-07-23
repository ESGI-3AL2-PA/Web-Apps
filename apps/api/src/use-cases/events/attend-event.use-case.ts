import type { Event } from "../../entities/event.entity.js";
import type { IEventRepository } from "../../repositories/Event/event.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";

/**
 * Cas d'usage : marquer la présence d'un utilisateur à un événement (avec note optionnelle).
 * Couche use-case (apps/api). Renvoie null si l'événement n'existe pas, sinon enregistre
 * durablement la présence dans Mongo puis projette l'arête correspondante dans le graphe.
 */
export const attendEventUseCase = (eventRepository: IEventRepository, graphRepository: IGraphRepository) => {
  return async (id: string, userId: string, rating?: number): Promise<Event | null> => {
    const event = await eventRepository.getEventById(id);
    if (!event) return null;

    // Mongo est la source de vérité ; l'arête Neo4j n'est qu'une projection best-effort. On
    // persiste durablement d'abord, pour ne pas perdre la présence/note si le graphe est indisponible.
    await eventRepository.recordAttendance(id, userId, rating);

    await syncGraph(`linkUserAttendedEvent(${userId}->${id})`, () =>
      graphRepository.linkUserAttendedEvent(userId, id, rating),
    );

    return event;
  };
};
