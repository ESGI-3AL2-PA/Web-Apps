import { initContract } from "@ts-rest/core";
import { z } from "zod";

import {
  CreateTagDtoSchema,
  TagParamsDtoSchema,
  TagQueryDtoSchema,
  TagResponseDtoSchema,
  UpdateTagDtoSchema,
  NotFoundErrorSchema,
  BadRequestErrorSchema,
  PaginatedResponseDtoSchema,
} from "./DTO";
import { auth } from "./auth-meta";

const c = initContract();

export const tagsContract = c.router({
  getTags: {
    method: "GET",
    path: "/tags",
    query: TagQueryDtoSchema,
    responses: {
      200: PaginatedResponseDtoSchema(TagResponseDtoSchema),
    },
    summary: "Get a paginated list of tags",
    metadata: auth({ audience: "api" }),
  },

  getTagById: {
    method: "GET",
    path: "/tags/:id",
    pathParams: TagParamsDtoSchema,
    responses: {
      200: TagResponseDtoSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Get a single tag by ID",
    // Reads are open to any authenticated user — the tag list (getTags) is
    // unscoped, so scoping single-tag reads by district only produced a 403 for
    // every non-admin (whose adminDistrictId is null) with no security benefit.
    metadata: auth({ audience: "api" }),
  },

  createTag: {
    method: "POST",
    path: "/tags",
    body: CreateTagDtoSchema,
    responses: {
      201: TagResponseDtoSchema,
      400: BadRequestErrorSchema,
    },
    summary: "Create a new tag (admin only)",
    metadata: auth({ audience: "api", roles: ["admin", "superAdmin"] }),
  },

  updateTag: {
    method: "PATCH",
    path: "/tags/:id",
    pathParams: TagParamsDtoSchema,
    body: UpdateTagDtoSchema,
    responses: {
      200: TagResponseDtoSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Partially update a tag (admin only)",
    metadata: auth({
      audience: "api",
      roles: ["admin", "superAdmin"],
      scope: {
        resource: "tag",
        districtField: "districtId",
        bypassRoles: ["superAdmin"],
      },
    }),
  },

  deleteTag: {
    method: "DELETE",
    path: "/tags/:id",
    pathParams: TagParamsDtoSchema,
    body: c.noBody(),
    responses: {
      204: z.undefined(),
      404: NotFoundErrorSchema,
    },
    summary: "Delete a tag (admin only)",
    metadata: auth({
      audience: "api",
      roles: ["admin", "superAdmin"],
      scope: {
        resource: "tag",
        districtField: "districtId",
        bypassRoles: ["superAdmin"],
      },
    }),
  },
});
