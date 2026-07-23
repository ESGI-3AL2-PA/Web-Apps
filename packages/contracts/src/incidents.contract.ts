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

/**
 * Contract ts-rest des signalements (incidents).
 *
 * Un signalement est rapporté par un résident et rattaché à un quartier.
 * La visibilité d'un signalement isolé est restreinte : un résident ne voit
 * que ses propres signalements, un administrateur de quartier voit ceux de son
 * quartier (404-sur-refus pour ne pas divulguer l'existence d'un signalement
 * voisin). Les modifications suivent la même portée (créateur ou admin).
 */
export const incidentsContract = c.router({
  // GET /incidents — liste paginée des signalements. Tout utilisateur authentifié.
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

  // GET /incidents/stats — statistiques agrégées des signalements (limitées au quartier pour les admins).
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
    // GET /incidents/:id — un signalement par son id. Rapporteur ou admin du quartier.
    // Un résident ne voit que ce qu'il a rapporté : `inDistrict` se base sur adminDistrictId,
    // null pour un utilisateur ordinaire, donc l'accès par quartier ne vaut que pour les admins.
    // 404-sur-refus pour qu'un signalement voisin ne divulgue pas son existence.
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

  // POST /incidents — rapporte un nouveau signalement. Tout utilisateur authentifié.
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

  // PATCH /incidents/:id — mise à jour partielle. Rapporteur (ownerField) ou admin du quartier.
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

  // DELETE /incidents/:id — supprime un signalement. Rapporteur ou admin du quartier.
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
