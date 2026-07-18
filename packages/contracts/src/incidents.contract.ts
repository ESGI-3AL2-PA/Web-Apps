import { initContract } from "@ts-rest/core";
import { z } from "zod";

import {
  CreateIncidentDtoSchema,
  IncidentParamsDtoSchema,
  IncidentQueryDtoSchema,
  IncidentResponseDtoSchema,
  IncidentStatsDtoSchema,
  IncidentStatsQueryDtoSchema,
  UpdateIncidentDtoSchema,
  NotFoundErrorSchema,
  ForbiddenErrorSchema,
  BadRequestErrorSchema,
  PaginatedResponseDtoSchema,
} from "./DTO";
import { auth } from "./auth-meta";

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
    metadata: auth({ audience: "api" }),
  },

  getIncidentStats: {
    method: "GET",
    path: "/incidents/stats",
    query: IncidentStatsQueryDtoSchema,
    responses: {
      200: IncidentStatsDtoSchema,
    },
    summary: "Get aggregated incident statistics (district-scoped for admins)",
    metadata: auth({ audience: "api" }),
  },

  getIncidentById: {
    method: "GET",
    path: "/incidents/:id",
    pathParams: IncidentParamsDtoSchema,
    responses: {
      200: IncidentResponseDtoSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Get a single incident by ID (reporter or district admin only)",
    // A resident sees only what they reported: `inDistrict` keys off adminDistrictId, which is
    // null for a plain user, so the district grant applies to admins alone. 404-on-deny so a
    // neighbour's report does not leak its existence.
    metadata: auth({
      audience: "api",
      scope: {
        resource: "incident",
        ownerField: "reporterId",
        districtField: "districtId",
        bypassRoles: ["superAdmin"],
        notFoundOnDeny: true,
      },
    }),
  },

  createIncident: {
    method: "POST",
    path: "/incidents",
    body: CreateIncidentDtoSchema,
    responses: {
      201: IncidentResponseDtoSchema,
    },
    summary: "Report a new incident",
    metadata: auth({ audience: "api" }),
  },

  updateIncident: {
    method: "PATCH",
    path: "/incidents/:id",
    pathParams: IncidentParamsDtoSchema,
    body: UpdateIncidentDtoSchema,
    responses: {
      200: IncidentResponseDtoSchema,
      400: BadRequestErrorSchema,
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Partially update an incident (reporter or admin only)",
    metadata: auth({
      audience: "api",
      scope: {
        resource: "incident",
        ownerField: "reporterId",
        districtField: "districtId",
        bypassRoles: ["superAdmin"],
      },
    }),
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
    metadata: auth({
      audience: "api",
      scope: {
        resource: "incident",
        ownerField: "reporterId",
        districtField: "districtId",
        bypassRoles: ["superAdmin"],
      },
    }),
  },
});
