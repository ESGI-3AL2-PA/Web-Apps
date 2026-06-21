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

export const eventsContract = c.router({
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
