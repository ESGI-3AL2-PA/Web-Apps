import { initContract } from "@ts-rest/core";
import { z } from "zod";

import {
  CreateUserDtoSchema,
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
    summary: "Get a single user by ID (self, same-district admin, or superAdmin)",
    metadata: auth({
      audience: "api",
      // Self (record id === subject) or an admin reading a user in their own district; superAdmin
      // bypasses. Mirrors the district scoping already applied to GET /users.
      scope: { resource: "user", ownerField: "id", districtField: "districtId", bypassRoles: ["superAdmin"] },
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
