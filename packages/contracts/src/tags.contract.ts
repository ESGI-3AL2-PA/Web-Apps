import { initContract } from "@ts-rest/core";
import { z } from "zod";

import {
  CreateTagDtoSchema,
  TagParamsDtoSchema,
  TagQueryDtoSchema,
  TagResponseDtoSchema,
  UpdateTagDtoSchema,
  NotFoundErrorSchema,
  PaginatedResponseDtoSchema,
} from "./DTO";

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
  },

  createTag: {
    method: "POST",
    path: "/tags",
    body: CreateTagDtoSchema,
    responses: {
      201: TagResponseDtoSchema,
    },
    summary: "Create a new tag",
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
    summary: "Partially update a tag",
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
    summary: "Delete a tag",
  },
});
