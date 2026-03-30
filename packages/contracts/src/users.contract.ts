import { initContract } from "@ts-rest/core";
import { z } from "zod";

import {
  CreateUserDtoSchema,
  NotFoundErrorSchema,
  UpdateUserDtoSchema,
  UserParamsDtoSchema,
  UserQueryDtoSchema,
  UserResponseDtoSchema,
} from "./DTO";

const c = initContract();

export const usersContract = c.router({
  getUsers: {
    method: "GET",
    path: "/users",
    query: UserQueryDtoSchema,
    responses: {
      200: z.object({
        data: z.array(UserResponseDtoSchema),
        total: z.number(),
        page: z.number(),
        limit: z.number(),
      }),
    },
    summary: "Get a paginated list of users",
  },

  getUserById: {
    method: "GET",
    path: "/users/:id",
    pathParams: UserParamsDtoSchema,
    responses: {
      200: UserResponseDtoSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Get a single user by ID",
  },

  createUser: {
    method: "POST",
    path: "/users",
    body: CreateUserDtoSchema,
    responses: {
      201: UserResponseDtoSchema,
    },
    summary: "Create a new user",
  },

  updateUser: {
    method: "PATCH",
    path: "/users/:id",
    pathParams: UserParamsDtoSchema,
    body: UpdateUserDtoSchema,
    responses: {
      200: UserResponseDtoSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Partially update a user",
  },

  deleteUser: {
    method: "DELETE",
    path: "/users/:id",
    pathParams: UserParamsDtoSchema,
    body: c.noBody(),
    responses: {
      204: z.undefined(),
      404: NotFoundErrorSchema,
    },
    summary: "Delete a user",
  },
});
