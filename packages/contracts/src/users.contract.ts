import { initContract } from "@ts-rest/core";
import { z } from "zod";

import {
  BanUserDtoSchema,
  CreateUserDtoSchema,
  ForbiddenErrorSchema,
  NotFoundErrorSchema,
  UnauthorizedErrorSchema,
  UpdateUserDtoSchema,
  UserParamsDtoSchema,
  UserQueryDtoSchema,
  UserResponseDtoSchema,
  PaginatedResponseDtoSchema,
} from "./DTO";
import { auth } from "./auth-meta";

const c = initContract();

export const usersContract = c.router({
  getUsers: {
    method: "GET",
    path: "/users",
    query: UserQueryDtoSchema,
    responses: {
      200: PaginatedResponseDtoSchema(UserResponseDtoSchema),
    },
    summary: "Get a paginated list of users",
    metadata: auth({ audience: "api", roles: ["admin", "superAdmin"] }),
  },

  getUserById: {
    method: "GET",
    path: "/users/:id",
    pathParams: UserParamsDtoSchema,
    responses: {
      200: UserResponseDtoSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Get a single user by ID (self or admin)",
    metadata: auth({
      audience: "api",
      scope: { resource: "user", selfParam: "id", bypassRoles: ["superAdmin"] },
    }),
  },

  createUser: {
    method: "POST",
    path: "/users",
    body: CreateUserDtoSchema,
    responses: {
      201: UserResponseDtoSchema,
    },
    summary: "Create a new user (internal service token only)",
    metadata: auth({ audience: "api:internal", roles: ["service"] }),
  },

  updateUser: {
    method: "PATCH",
    path: "/users/:id",
    pathParams: UserParamsDtoSchema,
    body: UpdateUserDtoSchema,
    responses: {
      200: UserResponseDtoSchema,
      401: UnauthorizedErrorSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Partially update a user (self or admin)",
    metadata: auth({
      audience: "api",
      scope: { resource: "user", selfParam: "id", bypassRoles: ["superAdmin"] },
    }),
  },

  banUser: {
    method: "PATCH",
    path: "/users/:id/ban",
    pathParams: UserParamsDtoSchema,
    body: BanUserDtoSchema,
    responses: {
      200: UserResponseDtoSchema,
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Ban or unban a regular user. Admins are scoped to their district; superAdmin any.",
    metadata: auth({
      audience: "api",
      roles: ["admin", "superAdmin"],
      scope: { resource: "user", districtField: "districtId", bypassRoles: ["superAdmin"] },
    }),
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
    summary: "Delete a user (admin only)",
    metadata: auth({ audience: "api", roles: ["admin", "superAdmin"] }),
  },
});
