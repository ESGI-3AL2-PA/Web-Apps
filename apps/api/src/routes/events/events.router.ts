import { initServer } from "@ts-rest/express";
import { eventsContract } from "@repo/contracts";
import { resolve } from "../../repositories/container.js";
import type { Request } from "express";
import { callerCanReadDistrict, resolveCallerListDistrict } from "../../middleware/district-scope.js";
import { getEventsUseCase } from "../../use-cases/events/get-events.use-case.js";
import { getEventByIdUseCase } from "../../use-cases/events/get-event-by-id.use-case.js";
import { createEventUseCase } from "../../use-cases/events/create-event.use-case.js";
import { updateEventUseCase } from "../../use-cases/events/update-event.use-case.js";
import { deleteEventUseCase } from "../../use-cases/events/delete-event.use-case.js";
import { registerToEventUseCase } from "../../use-cases/events/register-to-event.use-case.js";
import { unregisterFromEventUseCase } from "../../use-cases/events/unregister-from-event.use-case.js";
import { attendEventUseCase } from "../../use-cases/events/attend-event.use-case.js";
import { markInterestUseCase } from "../../use-cases/events/mark-interest.use-case.js";

const s = initServer();

// Les événements sont publics DANS un quartier, pas entre quartiers — et l'inscription
// consomme une place, donc la lecture ET les écritures doivent être bornées. On renvoie
// 404 (et non 403) pour ne pas divulguer l'existence d'un événement voisin.
const notFound = { status: 404 as const, body: { message: "Event not found" } };

const readableEvent = async (id: string, user: NonNullable<Request["user"]>) => {
  const event = await getEventByIdUseCase(resolve("event"))({ id });
  if (!event) return null;
  return (await callerCanReadDistrict(user, [event.districtId], resolve("user"))) ? event : null;
};

export const eventsRouter = s.router(eventsContract, {
  getEvents: async ({ query: { page, limit, search, status, districtId, creatorId, registrantId }, req }) => {
    const scope = await resolveCallerListDistrict(req.user!, districtId, resolve("user"));
    if ("empty" in scope) {
      return { status: 200, body: { data: [], total: 0, page, limit } };
    }
    // Non-privileged callers may only filter by their OWN registrations — otherwise
    // registrantId is an IDOR that enumerates a third party's event participation.
    const privileged = ["admin", "superAdmin", "service"].includes(req.user!.role);
    const scopedRegistrantId = registrantId && !privileged ? req.user!.sub : registrantId;
    const result = await getEventsUseCase(resolve("event"))({
      search,
      status,
      districtId: scope.districtId,
      creatorId,
      registrantId: scopedRegistrantId,
      page,
      limit,
    });
    return { status: 200, body: result };
  },

  getEventById: async ({ params: { id }, req }) => {
    const event = await readableEvent(id, req.user!);
    if (!event) return notFound;
    return { status: 200, body: event };
  },

  createEvent: async ({ body, req }) => {
    const newEvent = await createEventUseCase(
      resolve("event"),
      resolve("graph"),
    )({
      ...body,
      creatorId: req.user!.sub,
    });
    return { status: 201, body: newEvent };
  },

  updateEvent: async ({ params: { id }, body }) => {
    // Ownership/admin authorization is enforced by the contract-metadata middleware.
    const event = await updateEventUseCase(resolve("event"))(id, body);
    if (!event) {
      return { status: 404, body: { message: "Event not found" } };
    }
    return { status: 200, body: event };
  },

  deleteEvent: async ({ params: { id } }) => {
    const deleted = await deleteEventUseCase(resolve("event"), resolve("graph"))({ id });
    if (!deleted) {
      return { status: 404, body: { message: "Event not found" } };
    }
    return { status: 204, body: undefined };
  },

  registerToEvent: async ({ params: { id }, req }) => {
    if (!(await readableEvent(id, req.user!))) return notFound;
    const event = await registerToEventUseCase(resolve("event"), resolve("graph"))(id, req.user!.sub);
    if (!event) {
      return { status: 404, body: { message: "Event not found or no seats available" } };
    }
    return { status: 200, body: event };
  },

  unregisterFromEvent: async ({ params: { id }, req }) => {
    const event = await unregisterFromEventUseCase(resolve("event"), resolve("graph"))(id, req.user!.sub);
    if (!event) {
      return { status: 404, body: { message: "Event not found or user was not registered" } };
    }
    return { status: 200, body: event };
  },

  attendEvent: async ({ params: { id }, body: { rating }, req }) => {
    if (!(await readableEvent(id, req.user!))) return notFound;
    const event = await attendEventUseCase(resolve("event"), resolve("graph"))(id, req.user!.sub, rating);
    if (!event) {
      return { status: 404, body: { message: "Event not found" } };
    }
    return { status: 200, body: event };
  },

  markInterest: async ({ params: { id }, body: { rating }, req }) => {
    if (!(await readableEvent(id, req.user!))) return notFound;
    const found = await markInterestUseCase(resolve("event"), resolve("graph"))(req.user!.sub, id, rating);
    if (!found) {
      return { status: 404, body: { message: "Event not found" } };
    }
    return { status: 200, body: { success: true } };
  },
});
