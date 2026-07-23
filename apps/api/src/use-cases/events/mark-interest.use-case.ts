import type { IEventRepository } from "../../repositories/Event/event.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";

/**
 * Cas d'usage : enregistrer un signal d'intérêt (pouce haut/bas) sur un événement.
 * Couche use-case (apps/api). Renvoie false si l'événement n'existe pas, pour que la route
 * réponde 404 au lieu d'écrire une arête orpheline vers un noeud Event fantôme. L'écriture dans
 * le graphe est best-effort (un Neo4j dégradé ne doit pas faire échouer l'action de l'utilisateur).
 */
export const markInterestUseCase = (eventRepository: IEventRepository, graphRepository: IGraphRepository) => {
  return async (userId: string, eventId: string, scoreDelta: number): Promise<boolean> => {
    const event = await eventRepository.getEventById(eventId);
    if (!event) return false;

    // Mongo est la source de vérité ; l'arête Neo4j n'est qu'une projection best-effort. On
    // persiste durablement d'abord, pour ne pas perdre le signal d'intérêt si le graphe est indisponible.
    await eventRepository.recordInterest(eventId, userId, scoreDelta);

    await syncGraph(`linkUserInterestedInEvent(${userId}->${eventId})`, () =>
      graphRepository.linkUserInterestedInEvent(userId, eventId, scoreDelta),
    );
    return true;
  };
};
