import type { Event } from "../../entities/event.entity.js";
import type { IEventRepository } from "../../repositories/Event/event.repository.js";

/**
 * Cas d'usage : mettre a jour un evenement.
 *
 * Passe-plat vers le repository. Le patch exclut `id` et `createdAt` (champs
 * immuables) et n'accepte qu'un sous-ensemble partiel des champs de l'evenement.
 *
 * @returns l'evenement mis a jour, ou null si l'identifiant est introuvable.
 */
export const updateEventUseCase = (eventRepository: IEventRepository) => {
  return async (id: string, data: Partial<Omit<Event, "id" | "createdAt">>): Promise<Event | null> => {
    return await eventRepository.updateEvent(id, data);
  };
};
