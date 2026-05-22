import type { IEventRepository } from "../../repositories/Event/event.repository.js";

export const getEventByIdUseCase = (eventRepository: IEventRepository) => {
  return async (params: { id: string }) => {
    return await eventRepository.getEventById(params.id);
  };
};
