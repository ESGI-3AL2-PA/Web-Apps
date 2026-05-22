import type { IEventRepository } from "../../repositories/Event/event.repository.js";

export const getEventsUseCase = (eventRepository: IEventRepository) => {
  return async (params: {
    search?: string;
    status?: string;
    districtId?: string;
    creatorId?: string;
    page?: number;
    limit?: number;
  }) => {
    return await eventRepository.getEvents(params);
  };
};
