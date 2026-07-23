import { initContract } from "@ts-rest/core";
import { z } from "zod";

import {
  AttendEventDtoSchema,
  CreateEventDtoSchema,
  EventParamsDtoSchema,
  EventQueryDtoSchema,
  EventResponseDtoSchema,
  UpdateEventDtoSchema,
  MarkInterestDtoSchema,
  MarkInterestResponseDtoSchema,
  NotFoundErrorSchema,
  ForbiddenErrorSchema,
  PaginatedResponseDtoSchema,
} from "./DTO";
import { auth } from "./auth-meta";

const c = initContract();

/**
 * Contract ts-rest des événements.
 *
 * Lectures ouvertes à tout utilisateur authentifié. La création est ouverte ;
 * la mise à jour et la suppression sont réservées au créateur ou à un
 * administrateur du quartier de l'événement (bypass superAdmin). Des routes
 * complémentaires gèrent l'inscription, la présence et les signaux d'intérêt
 * (ces derniers alimentant le moteur de recommandation Neo4j).
 */
export const eventsContract = c.router({
  // GET /events — liste paginée des événements. Tout utilisateur authentifié.
  getEvents: {
    method: "GET",
    path: "/events",
    query: EventQueryDtoSchema,
    responses: {
      200: PaginatedResponseDtoSchema(EventResponseDtoSchema),
    },
    summary: "Get a paginated list of events",
    metadata: auth({ audience: "api" }),
  },

  // GET /events/:id — un événement par son id. Tout utilisateur authentifié.
  getEventById: {
    method: "GET",
    path: "/events/:id",
    pathParams: EventParamsDtoSchema,
    responses: {
      200: EventResponseDtoSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Get a single event by ID",
    metadata: auth({ audience: "api" }),
  },

  // POST /events — crée un événement. Tout utilisateur authentifié.
  createEvent: {
    method: "POST",
    path: "/events",
    body: CreateEventDtoSchema,
    responses: {
      201: EventResponseDtoSchema,
    },
    summary: "Create a new event",
    metadata: auth({ audience: "api" }),
  },

  // PATCH /events/:id — mise à jour partielle. Créateur (ownerField) ou admin du quartier de l'événement.
  updateEvent: {
    method: "PATCH",
    path: "/events/:id",
    pathParams: EventParamsDtoSchema,
    body: UpdateEventDtoSchema,
    responses: {
      200: EventResponseDtoSchema,
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Partially update an event (creator or admin only)",
    metadata: auth({
      audience: "api",
      scope: {
        resource: "event",
        ownerField: "creatorId",
        districtField: "districtId",
        bypassRoles: ["superAdmin"],
      },
    }),
  },

  // DELETE /events/:id — supprime un événement. Créateur ou admin du quartier de l'événement.
  deleteEvent: {
    method: "DELETE",
    path: "/events/:id",
    pathParams: EventParamsDtoSchema,
    body: c.noBody(),
    responses: {
      204: z.undefined(),
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Delete an event (creator or admin only)",
    metadata: auth({
      audience: "api",
      scope: {
        resource: "event",
        ownerField: "creatorId",
        districtField: "districtId",
        bypassRoles: ["superAdmin"],
      },
    }),
  },

  // POST /events/:id/register — inscrit l'utilisateur authentifié à l'événement.
  registerToEvent: {
    method: "POST",
    path: "/events/:id/register",
    pathParams: EventParamsDtoSchema,
    body: c.noBody(),
    responses: {
      200: EventResponseDtoSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Register the authenticated user to an event",
    metadata: auth({ audience: "api" }),
  },

  // DELETE /events/:id/register — annule l'inscription de l'utilisateur authentifié.
  unregisterFromEvent: {
    method: "DELETE",
    path: "/events/:id/register",
    pathParams: EventParamsDtoSchema,
    body: c.noBody(),
    responses: {
      200: EventResponseDtoSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Cancel the authenticated user's registration to an event",
    metadata: auth({ audience: "api" }),
  },

  // POST /events/:id/attend — marque la présence d'un utilisateur à l'événement (avec note optionnelle).
  attendEvent: {
    method: "POST",
    path: "/events/:id/attend",
    pathParams: EventParamsDtoSchema,
    body: AttendEventDtoSchema,
    responses: {
      200: EventResponseDtoSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Mark that a user attended the event (and optionally rate it)",
    metadata: auth({ audience: "api" }),
  },

  // POST /events/:id/interest — exprime un intérêt (👍) ou désintérêt (👎) ; alimente le moteur de reco Neo4j.
  markInterest: {
    method: "POST",
    path: "/events/:id/interest",
    pathParams: EventParamsDtoSchema,
    body: MarkInterestDtoSchema,
    responses: {
      200: MarkInterestResponseDtoSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Express interest (👍) or disinterest (👎) for an event — feeds Neo4j recommendation engine",
    metadata: auth({ audience: "api" }),
  },
});
