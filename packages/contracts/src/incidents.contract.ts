import { initContract } from "@ts-rest/core";
import { z } from "zod";

import {
  CreateIncidentDtoSchema,
  IncidentParamsDtoSchema,
  IncidentQueryDtoSchema,
  IncidentResponseDtoSchema,
  IncidentStatsDtoSchema,
  UpdateIncidentDtoSchema,
  NotFoundErrorSchema,
  ForbiddenErrorSchema,
  PaginatedResponseDtoSchema,
} from "./DTO";

const c = initContract();

export const incidentsContract = c.router({
  getIncidents: {
    method: "GET",
    path: "/incidents",
    query: IncidentQueryDtoSchema,
    responses: {
      200: PaginatedResponseDtoSchema(IncidentResponseDtoSchema),
    },
    summary: "Get a paginated list of incidents",
  },

  getIncidentStats: {
    method: "GET",
    path: "/incidents/stats",
    responses: {
      200: IncidentStatsDtoSchema,
    },
    summary: "Get aggregated incident statistics",
  },

  getIncidentById: {
    method: "GET",
    path: "/incidents/:id",
    pathParams: IncidentParamsDtoSchema,
    responses: {
      200: IncidentResponseDtoSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Get a single incident by ID",
  },

  createIncident: {
    method: "POST",
    path: "/incidents",
    body: CreateIncidentDtoSchema,
    responses: {
      201: IncidentResponseDtoSchema,
    },
    summary: "Report a new incident",
  },

  updateIncident: {
    method: "PATCH",
    path: "/incidents/:id",
    pathParams: IncidentParamsDtoSchema,
    body: UpdateIncidentDtoSchema,
    responses: {
      200: IncidentResponseDtoSchema,
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Partially update an incident (reporter or admin only)",
  },

  deleteIncident: {
    method: "DELETE",
    path: "/incidents/:id",
    pathParams: IncidentParamsDtoSchema,
    body: c.noBody(),
    responses: {
      204: z.undefined(),
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Delete an incident (reporter or admin only)",
  },
});
