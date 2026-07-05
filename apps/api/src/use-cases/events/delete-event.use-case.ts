import type { IEventRepository } from "../../repositories/Event/event.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";

export const deleteEventUseCase = (
  eventRepository: IEventRepository,
  graphRepository: IGraphRepository,
) => {
  return async (params: { id: string }): Promise<boolean> => {
    const deleted = await eventRepository.deleteEvent(params.id);
    if (deleted) {
      await syncGraph(`deleteEvent(${params.id})`, () => graphRepository.deleteEvent(params.id));
    }
    return deleted;
  };
};
