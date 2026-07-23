import type { IEventRepository } from "../../repositories/Event/event.repository.js";

/**
 * Cas d'usage : récupération d'un événement par son identifiant.
 * Couche use-case (apps/api). Pass-through vers le repository ; renvoie l'événement ou null.
 */
export const getEventByIdUseCase = (eventRepository: IEventRepository) => {
  return async (params: { id: string }) => {
    return await eventRepository.getEventById(params.id);
  };
};
