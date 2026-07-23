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

/**
 * Router ts-rest des événements de quartier (création, inscription/désinscription,
 * pointage de présence, marque d'intérêt et notation). Les écritures propagent aussi
 * des relations dans le graphe (repository "graph").
 */

// Les événements sont publics DANS un quartier, pas entre quartiers — et l'inscription
// consomme une place, donc la lecture ET les écritures doivent être bornées. On renvoie
// 404 (et non 403) pour ne pas divulguer l'existence d'un événement voisin.
const notFound = { status: 404 as const, body: { message: "Event not found" } };

// Charge un événement et ne le renvoie que si l'appelant peut lire son quartier
// (sinon null → 404), pour éviter de divulguer un événement d'un quartier voisin.
const readableEvent = async (id: string, user: NonNullable<Request["user"]>) => {
  const event = await getEventByIdUseCase(resolve("event"))({ id });
  if (!event) return null;
  return (await callerCanReadDistrict(user, [event.districtId], resolve("user"))) ? event : null;
};

export const eventsRouter = s.router(eventsContract, {
  // GET /events — liste paginée, bornée au(x) quartier(s) lisibles par l'appelant.
  getEvents: async ({ query: { page, limit, search, status, districtId, creatorId, registrantId }, req }) => {
    const scope = await resolveCallerListDistrict(req.user!, districtId, resolve("user"));
    if ("empty" in scope) {
      return { status: 200, body: { data: [], total: 0, page, limit } };
    }
    // Un appelant non privilégié ne peut filtrer que sur SES propres inscriptions —
    // sinon registrantId devient un IDOR qui énumère la participation d'un tiers.
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

  // GET /events/:id — détail (404 si l'événement n'est pas dans un quartier lisible).
  getEventById: async ({ params: { id }, req }) => {
    const event = await readableEvent(id, req.user!);
    if (!event) return notFound;
    return { status: 200, body: event };
  },

  // POST /events — crée un événement dont le créateur est l'appelant.
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

  // PATCH /events/:id — met à jour un événement. Autorisation propriétaire/admin
  // assurée par le middleware contract-metadata.
  updateEvent: async ({ params: { id }, body }) => {
    const event = await updateEventUseCase(resolve("event"))(id, body);
    if (!event) {
      return { status: 404, body: { message: "Event not found" } };
    }
    return { status: 200, body: event };
  },

  // DELETE /events/:id — supprime un événement (et nettoie le graphe).
  deleteEvent: async ({ params: { id } }) => {
    const deleted = await deleteEventUseCase(resolve("event"), resolve("graph"))({ id });
    if (!deleted) {
      return { status: 404, body: { message: "Event not found" } };
    }
    return { status: 204, body: undefined };
  },

  // POST /events/:id/register — inscrit l'appelant (consomme une place). 404 si
  // événement illisible ou complet.
  registerToEvent: async ({ params: { id }, req }) => {
    if (!(await readableEvent(id, req.user!))) return notFound;
    const event = await registerToEventUseCase(resolve("event"), resolve("graph"))(id, req.user!.sub);
    if (!event) {
      return { status: 404, body: { message: "Event not found or no seats available" } };
    }
    return { status: 200, body: event };
  },

  // POST /events/:id/unregister — désinscrit l'appelant (libère sa place).
  unregisterFromEvent: async ({ params: { id }, req }) => {
    const event = await unregisterFromEventUseCase(resolve("event"), resolve("graph"))(id, req.user!.sub);
    if (!event) {
      return { status: 404, body: { message: "Event not found or user was not registered" } };
    }
    return { status: 200, body: event };
  },

  // POST /events/:id/attend — l'appelant pointe sa présence et note l'événement.
  attendEvent: async ({ params: { id }, body: { rating }, req }) => {
    if (!(await readableEvent(id, req.user!))) return notFound;
    const event = await attendEventUseCase(resolve("event"), resolve("graph"))(id, req.user!.sub, rating);
    if (!event) {
      return { status: 404, body: { message: "Event not found" } };
    }
    return { status: 200, body: event };
  },

  // POST /events/:id/interest — l'appelant marque son intérêt (arête pondérée dans le graphe).
  markInterest: async ({ params: { id }, body: { rating }, req }) => {
    if (!(await readableEvent(id, req.user!))) return notFound;
    const found = await markInterestUseCase(resolve("event"), resolve("graph"))(req.user!.sub, id, rating);
    if (!found) {
      return { status: 404, body: { message: "Event not found" } };
    }
    return { status: 200, body: { success: true } };
  },
});
