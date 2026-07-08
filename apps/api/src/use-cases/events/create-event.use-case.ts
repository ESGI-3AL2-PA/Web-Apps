import type { CreateEventDto } from "@repo/contracts";
import type { Event } from "../../entities/event.entity.js";
import type { IEventRepository } from "../../repositories/Event/event.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";

export const createEventUseCase = (eventRepository: IEventRepository, graphRepository: IGraphRepository) => {
  return async (data: CreateEventDto & { creatorId: string }): Promise<Event> => {
    const event = await eventRepository.createEvent({
      ...data,
      remainingSeats: data.totalSeats,
      status: "upcoming",
      registrants: [],
    });

    // Independent graph projections — node + creator + district edges — run in parallel.
    await Promise.all([
      syncGraph(`upsertEvent(${event.id})`, () =>
        graphRepository.upsertEvent({ id: event.id, title: event.title, date: event.eventDate }),
      ),
      ...(event.creatorId
        ? [
            syncGraph(`linkUserCreatedEvent(${event.creatorId}->${event.id})`, () =>
              graphRepository.linkUserCreatedEvent(event.creatorId, event.id),
            ),
          ]
        : []),
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
