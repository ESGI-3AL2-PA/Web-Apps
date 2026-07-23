import type { IEventRepository } from "../../repositories/Event/event.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";

/**
 * Cas d'usage : suppression d'un événement.
 * Couche use-case (apps/api). Supprime dans Mongo puis, seulement en cas de suppression effective,
 * retire le noeud correspondant du graphe (projection best-effort).
 */
export const deleteEventUseCase = (eventRepository: IEventRepository, graphRepository: IGraphRepository) => {
  return async (params: { id: string }): Promise<boolean> => {
    const deleted = await eventRepository.deleteEvent(params.id);
    // On ne touche au graphe que si Mongo a effectivement supprimé l'événement.
    if (deleted) {
      await syncGraph(`deleteEvent(${params.id})`, () => graphRepository.deleteEvent(params.id));
    }
    return deleted;
  };
};
