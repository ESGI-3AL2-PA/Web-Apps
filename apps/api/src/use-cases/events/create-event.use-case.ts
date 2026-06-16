import type { CreateEventDto } from "@repo/contracts";
import type { Event } from "../../entities/event.entity.js";
import type { IEventRepository } from "../../repositories/Event/event.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";

export const createEventUseCase = (
  eventRepository: IEventRepository,
  graphRepository: IGraphRepository,
) => {
  return async (data: CreateEventDto & { creatorId: string }): Promise<Event> => {
    const event = await eventRepository.createEvent({
      ...data,
      remainingSeats: data.totalSeats,
      status: "upcoming",
      registrants: [],
    });

    // Graph projection: node + creator + district + tag edges (if any).
    await syncGraph(`upsertEvent(${event.id})`, () =>
      graphRepository.upsertEvent({ id: event.id, title: event.title, date: event.eventDate }),
    );
    if (event.creatorId) {
      await syncGraph(`linkUserCreatedEvent(${event.creatorId}->${event.id})`, () =>
        graphRepository.linkUserCreatedEvent(event.creatorId, event.id),
      );
    }
    if (event.districtId) {
      await syncGraph(`linkDistrictContainsEvent(${event.districtId}->${event.id})`, () =>
        graphRepository.linkDistrictContainsEvent(event.districtId, event.id),
      );
    }
    return event;
  };
};
