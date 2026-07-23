import type { CreateEventDto } from "@repo/contracts";
import type { Event } from "../../entities/event.entity.js";
import type { IEventRepository } from "../../repositories/Event/event.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";

/**
 * Cas d'usage : création d'un événement.
 * Couche use-case (apps/api). Persiste l'événement dans Mongo (places restantes = places totales,
 * statut initial "upcoming", liste d'inscrits vide) puis projette en parallèle le noeud et ses
 * arêtes (créateur, quartier) dans le graphe.
 */
export const createEventUseCase = (eventRepository: IEventRepository, graphRepository: IGraphRepository) => {
  return async (data: CreateEventDto & { creatorId: string }): Promise<Event> => {
    const event = await eventRepository.createEvent({
      ...data,
      remainingSeats: data.totalSeats,
      status: "upcoming",
      registrants: [],
    });

    // Projections de graphe indépendantes — noeud + arêtes créateur + quartier — exécutées en parallèle.
    await Promise.all([
      syncGraph(`upsertEvent(${event.id})`, () =>
        graphRepository.upsertEvent({ id: event.id, title: event.title, date: event.eventDate }),
      ),
      // Arête créateur seulement si l'événement a un créateur renseigné.
      ...(event.creatorId
        ? [
            syncGraph(`linkUserCreatedEvent(${event.creatorId}->${event.id})`, () =>
              graphRepository.linkUserCreatedEvent(event.creatorId, event.id),
            ),
          ]
        : []),
      // Arête quartier seulement si l'événement est rattaché à un quartier.
      ...(event.districtId
        ? [
            syncGraph(`linkDistrictContainsEvent(${event.districtId}->${event.id})`, () =>
              graphRepository.linkDistrictContainsEvent(event.districtId, event.id),
            ),
          ]
        : []),
    ]);
    return event;
  };
};
