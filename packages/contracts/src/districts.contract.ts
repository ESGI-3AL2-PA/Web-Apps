import { initContract } from "@ts-rest/core";
import { z } from "zod";

import {
  CreateDistrictDtoSchema,
  DistrictParamsDtoSchema,
  DistrictQueryDtoSchema,
  DistrictResponseDtoSchema,
  UpdateDistrictDtoSchema,
  ConflictErrorSchema,
  NotFoundErrorSchema,
  PaginatedResponseDtoSchema,
} from "./DTO";
import { auth } from "./auth-meta";

const c = initContract();

/**
 * Contract ts-rest des quartiers (districts).
 *
 * Un quartier porte un polygone de délimitation et une liste de membres. Les
 * lectures sont ouvertes à tout utilisateur authentifié ; la création et la
 * suppression sont réservées au superAdmin ; la mise à jour est ouverte aux
 * administrateurs de quartier mais restreinte à leur propre quartier.
 */
export const districtsContract = c.router({
  // GET /districts — liste paginée des quartiers. Tout utilisateur authentifié.
  getDistricts: {
    method: "GET",
    path: "/districts",
    query: DistrictQueryDtoSchema,
    responses: {
      200: PaginatedResponseDtoSchema(DistrictResponseDtoSchema),
    },
    summary: "Get a paginated list of districts",
    metadata: auth({ audience: "api" }),
  },

  // GET /districts/:id — un quartier par son id. Tout utilisateur authentifié.
  getDistrictById: {
    method: "GET",
    path: "/districts/:id",
    pathParams: DistrictParamsDtoSchema,
    responses: {
      200: DistrictResponseDtoSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Get a single district by ID",
    metadata: auth({ audience: "api" }),
  },

  // POST /districts — crée un quartier. superAdmin uniquement.
  createDistrict: {
    method: "POST",
    path: "/districts",
    body: CreateDistrictDtoSchema,
    responses: {
      201: DistrictResponseDtoSchema,
      // Garde-fou du polygone : la délimitation laisserait un ou plusieurs membres actuels en dehors.
      409: ConflictErrorSchema,
    },
    summary: "Create a new district (superAdmin only)",
    metadata: auth({ audience: "api", roles: ["superAdmin"] }),
  },

  // PATCH /districts/:id — mise à jour partielle. Admin de quartier (le sien) ou superAdmin (n'importe lequel).
  updateDistrict: {
    method: "PATCH",
    path: "/districts/:id",
    pathParams: DistrictParamsDtoSchema,
    body: UpdateDistrictDtoSchema,
    responses: {
      200: DistrictResponseDtoSchema,
      // Garde-fou du polygone : la nouvelle délimitation laisserait un ou plusieurs membres actuels en dehors.
      409: ConflictErrorSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Partially update a district. District admins may only edit their own; superAdmin any.",
    // districtField:"id" — l'id de l'enregistrement lui-même doit égaler l'adminDistrictId de l'appelant,
    // de sorte qu'un administrateur de quartier ne peut modifier un quartier qu'il n'administre pas.
    metadata: auth({
      audience: "api",
      roles: ["admin", "superAdmin"],
      scope: { resource: "district", districtField: "id", bypassRoles: ["superAdmin"] },
    }),
  },

  // DELETE /districts/:id — supprime un quartier. superAdmin uniquement.
  deleteDistrict: {
    method: "DELETE",
    path: "/districts/:id",
    pathParams: DistrictParamsDtoSchema,
    body: c.noBody(),
    responses: {
      204: z.undefined(),
      404: NotFoundErrorSchema,
    },
    summary: "Delete a district (superAdmin only)",
    metadata: auth({ audience: "api", roles: ["superAdmin"] }),
  },
});
