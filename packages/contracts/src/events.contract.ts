import { initContract } from "@ts-rest/core";
import { z } from "zod";

import {
  AttendEventDtoSchema,
  CreateEventDtoSchema,
  EventParamsDtoSchema,
  EventQueryDtoSchema,
  EventResponseDtoSchema,
  RegisterEventDtoSchema,
  UpdateEventDtoSchema,
  NotFoundErrorSchema,
  PaginatedResponseDtoSchema,
} from "./DTO";

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
  },

  createEvent: {
    method: "POST",
    path: "/events",
    body: CreateEventDtoSchema,
    responses: {
      201: EventResponseDtoSchema,
    },
    summary: "Create a new event",
  },

  updateEvent: {
    method: "PATCH",
    path: "/events/:id",
    pathParams: EventParamsDtoSchema,
    body: UpdateEventDtoSchema,
    responses: {
      200: EventResponseDtoSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Partially update an event",
  },

  deleteEvent: {
    method: "DELETE",
    path: "/events/:id",
    pathParams: EventParamsDtoSchema,
    body: c.noBody(),
    responses: {
      204: z.undefined(),
      404: NotFoundErrorSchema,
    },
    summary: "Delete an event",
  },

  registerToEvent: {
    method: "POST",
    path: "/events/:id/register",
    pathParams: EventParamsDtoSchema,
    body: RegisterEventDtoSchema,
    responses: {
      200: EventResponseDtoSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Register a user to an event",
  },

  unregisterFromEvent: {
    method: "DELETE",
    path: "/events/:id/register",
    pathParams: EventParamsDtoSchema,
    body: RegisterEventDtoSchema,
    responses: {
      200: EventResponseDtoSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Cancel a user's registration to an event",
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
  },
});
