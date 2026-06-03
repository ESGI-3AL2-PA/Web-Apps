import { initServer } from "@ts-rest/express";
import { eventsContract } from "@repo/contracts";
import { resolve } from "../../repositories/container.js";
import { getEventsUseCase } from "../../use-cases/events/get-events.use-case.js";
import { getEventByIdUseCase } from "../../use-cases/events/get-event-by-id.use-case.js";
import { createEventUseCase } from "../../use-cases/events/create-event.use-case.js";
import { updateEventUseCase } from "../../use-cases/events/update-event.use-case.js";
import { deleteEventUseCase } from "../../use-cases/events/delete-event.use-case.js";
import { registerToEventUseCase } from "../../use-cases/events/register-to-event.use-case.js";
import { unregisterFromEventUseCase } from "../../use-cases/events/unregister-from-event.use-case.js";
import { attendEventUseCase } from "../../use-cases/events/attend-event.use-case.js";

const s = initServer();

export const eventsRouter = s.router(eventsContract, {
  getEvents: async ({ query: { page, limit, search, status, districtId, creatorId } }) => {
    const result = await getEventsUseCase(resolve("event"))({
      search,
      status,
      districtId,
      creatorId,
      page,
      limit,
    });
    return { status: 200, body: result };
  },

  getEventById: async ({ params: { id } }) => {
    const event = await getEventByIdUseCase(resolve("event"))({ id });
    if (!event) {
      return { status: 404, body: { message: "Event not found" } };
    }
    return { status: 200, body: event };
  },

  createEvent: async ({ body, req }) => {
    const newEvent = await createEventUseCase(resolve("event"))({
      ...body,
      creatorId: req.user!.sub,
    });
    return { status: 201, body: newEvent };
  },

  updateEvent: async ({ params: { id }, body, req }) => {
    const existing = await getEventByIdUseCase(resolve("event"))({ id });
    if (!existing) {
      return { status: 404, body: { message: "Event not found" } };
    }
    if (existing.creatorId !== req.user!.sub && req.user!.role !== "admin") {
      return { status: 403, body: { message: "Creator or admin only" } };
    }
    const event = await updateEventUseCase(resolve("event"))(id, body);
    if (!event) {
      return { status: 404, body: { message: "Event not found" } };
    }
    return { status: 200, body: event };
  },

  deleteEvent: async ({ params: { id }, req }) => {
    const existing = await getEventByIdUseCase(resolve("event"))({ id });
    if (!existing) {
      return { status: 404, body: { message: "Event not found" } };
    }
    if (existing.creatorId !== req.user!.sub && req.user!.role !== "admin") {
      return { status: 403, body: { message: "Creator or admin only" } };
    }
    const deleted = await deleteEventUseCase(resolve("event"))({ id });
    if (!deleted) {
      return { status: 404, body: { message: "Event not found" } };
    }
    return { status: 204, body: undefined };
  },

  registerToEvent: async ({ params: { id }, req }) => {
    const event = await registerToEventUseCase(resolve("event"))(id, req.user!.sub);
    if (!event) {
      return { status: 404, body: { message: "Event not found or no seats available" } };
    }
    return { status: 200, body: event };
  },

  unregisterFromEvent: async ({ params: { id }, req }) => {
    const event = await unregisterFromEventUseCase(resolve("event"))(id, req.user!.sub);
    if (!event) {
      return { status: 404, body: { message: "Event not found or user was not registered" } };
    }
    return { status: 200, body: event };
  },

  attendEvent: async ({ params: { id }, body: { rating }, req }) => {
    const event = await attendEventUseCase(resolve("event"))(id, req.user!.sub, rating);
    if (!event) {
      return { status: 404, body: { message: "Event not found" } };
    }
    return { status: 200, body: event };
  },
});
