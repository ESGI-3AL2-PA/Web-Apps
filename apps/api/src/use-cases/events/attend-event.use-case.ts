import type { Event } from "../../entities/event.entity.js";
import type { IEventRepository } from "../../repositories/Event/event.repository.js";

export const attendEventUseCase = (eventRepository: IEventRepository) => {
  return async (id: string, _userId: string, _rating?: number): Promise<Event | null> => {
    // Attendance + rating is also a Neo4j-side concern (User-[:ATTENDED {rating}]->Event).
    // On the Mongo side we only ensure the event still exists; richer attendance
    // tracking can be layered on later.
    return await eventRepository.getEventById(id);
  };
};
