import type { IEventRepository } from "../../repositories/Event/event.repository.js";

export const deleteEventUseCase = (eventRepository: IEventRepository) => {
  return async (params: { id: string }): Promise<boolean> => {
    return await eventRepository.deleteEvent(params.id);
  };
};
