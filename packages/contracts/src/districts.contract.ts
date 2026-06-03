import { initContract } from "@ts-rest/core";
import { z } from "zod";

import {
  CreateDistrictDtoSchema,
  DistrictParamsDtoSchema,
  DistrictQueryDtoSchema,
  DistrictResponseDtoSchema,
  UpdateDistrictDtoSchema,
  NotFoundErrorSchema,
  PaginatedResponseDtoSchema,
} from "./DTO";
import { auth } from "./auth-meta";

const c = initContract();

export const districtsContract = c.router({
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

  createDistrict: {
    method: "POST",
    path: "/districts",
    body: CreateDistrictDtoSchema,
    responses: {
      201: DistrictResponseDtoSchema,
    },
    summary: "Create a new district (admin only)",
    metadata: auth({ audience: "api", roles: ["admin", "superAdmin"] }),
  },

  updateDistrict: {
    method: "PATCH",
    path: "/districts/:id",
    pathParams: DistrictParamsDtoSchema,
    body: UpdateDistrictDtoSchema,
    responses: {
      200: DistrictResponseDtoSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Partially update a district (admin only)",
    metadata: auth({ audience: "api", roles: ["admin", "superAdmin"] }),
  },

  deleteDistrict: {
    method: "DELETE",
    path: "/districts/:id",
    pathParams: DistrictParamsDtoSchema,
    body: c.noBody(),
    responses: {
      204: z.undefined(),
      404: NotFoundErrorSchema,
    },
    summary: "Delete a district (admin only)",
    metadata: auth({ audience: "api", roles: ["admin", "superAdmin"] }),
  },
});
