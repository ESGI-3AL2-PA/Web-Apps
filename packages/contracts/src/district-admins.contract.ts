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

// District-admins management is restricted to superAdmin: it's a privilege escalation.
export const districtAdminsContract = c.router({
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
