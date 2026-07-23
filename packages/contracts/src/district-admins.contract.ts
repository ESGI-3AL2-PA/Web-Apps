import { initContract } from "@ts-rest/core";
import { z } from "zod";

import {
  CreateDistrictAdminDtoSchema,
  DistrictAdminParamsDtoSchema,
  DistrictAdminQueryDtoSchema,
  DistrictAdminResponseDtoSchema,
  ConflictErrorSchema,
  NotFoundErrorSchema,
  PaginatedResponseDtoSchema,
} from "./DTO";
import { auth } from "./auth-meta";

const c = initContract();

/**
 * Contract ts-rest des affectations administrateur de quartier.
 *
 * Une affectation lie un utilisateur à un quartier qu'il administre. La gestion
 * de ces affectations est réservée au superAdmin : accorder ce rôle est une
 * escalade de privilège, donc toutes les routes exigent `roles: ["superAdmin"]`.
 */
export const districtAdminsContract = c.router({
  // GET /district-admins — liste paginée des affectations, filtrable par quartier ou utilisateur. superAdmin.
  getDistrictAdmins: {
    method: "GET",
    path: "/district-admins",
    query: DistrictAdminQueryDtoSchema,
    responses: {
      200: PaginatedResponseDtoSchema(DistrictAdminResponseDtoSchema),
    },
    summary: "List district-admin assignments (paginated, filterable by district or user)",
    metadata: auth({ audience: "api", roles: ["superAdmin"] }),
  },

  // GET /district-admins/:id — une affectation par son id. superAdmin.
  getDistrictAdminById: {
    method: "GET",
    path: "/district-admins/:id",
    pathParams: DistrictAdminParamsDtoSchema,
    responses: {
      200: DistrictAdminResponseDtoSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Get a single district-admin assignment by ID",
    metadata: auth({ audience: "api", roles: ["superAdmin"] }),
  },

  // POST /district-admins — accorde à un utilisateur les droits d'admin sur un quartier. 409 si déjà admin. superAdmin.
  createDistrictAdmin: {
    method: "POST",
    path: "/district-admins",
    body: CreateDistrictAdminDtoSchema,
    responses: {
      201: DistrictAdminResponseDtoSchema,
      409: ConflictErrorSchema,
    },
    summary: "Grant a user admin rights on a district",
    metadata: auth({ audience: "api", roles: ["superAdmin"] }),
  },

  // DELETE /district-admins/:id — révoque les droits d'administrateur de quartier. superAdmin.
  deleteDistrictAdmin: {
    method: "DELETE",
    path: "/district-admins/:id",
    pathParams: DistrictAdminParamsDtoSchema,
    body: c.noBody(),
    responses: {
      204: z.undefined(),
      404: NotFoundErrorSchema,
    },
    summary: "Revoke district-admin rights",
    metadata: auth({ audience: "api", roles: ["superAdmin"] }),
  },
});
