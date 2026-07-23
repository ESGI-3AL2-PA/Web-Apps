import type { Event } from "../../entities/event.entity.js";
import type { IEventRepository } from "../../repositories/Event/event.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";

/**
 * Cas d'usage : desinscrire un utilisateur d'un evenement.
 *
 * Retire l'utilisateur de la liste des inscrits cote Mongo, puis miroite la
 * suppression dans le graphe Neo4j (arete « inscrit a l'evenement »). Le miroir
 * n'est declenche que si le retrait Mongo a effectivement renvoye l'evenement
 * (evenement existant et utilisateur bien inscrit).
 *
 * @returns l'evenement mis a jour, ou null si l'evenement est introuvable.
 */
export const unregisterFromEventUseCase = (eventRepository: IEventRepository, graphRepository: IGraphRepository) => {
  return async (id: string, userId: string): Promise<Event | null> => {
    const event = await eventRepository.removeRegistrant(id, userId);
    if (event) {
      // syncGraph est best-effort : il journalise et poursuit si Neo4j est degrade.
      await syncGraph(`unlinkUserRegisteredForEvent(${userId}->${id})`, () =>
        graphRepository.unlinkUserRegisteredForEvent(userId, id),
      );
    }
    return event;
  };
};
