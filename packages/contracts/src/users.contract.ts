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
  UserDataExportResponseDtoSchema,
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

  exportUserData: {
    method: "GET",
    path: "/users/:id/export",
    pathParams: UserParamsDtoSchema,
    responses: {
      200: UserDataExportResponseDtoSchema,
      404: NotFoundErrorSchema,
    },
    // GDPR Art. 15/20: canonical server-side export of ALL of the caller's personal
    // data in one authenticated call. Strictly self-scoped (selfParam:"id", NO admin
    // bypass — this dumps private messages/sessions; an admin has no business pulling
    // another user's full export here). notFoundOnDeny hides other users' existence.
    summary: "Export all of your personal data as a single JSON document (self only).",
    metadata: auth({
      audience: "api",
      scope: { resource: "user", selfParam: "id", notFoundOnDeny: true },
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
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
    },
    // Self-service account deletion (GDPR erasure): a user may delete ONLY their own
    // account — selfParam:"id", no superAdmin bypass (admins can't delete others via
    // this route; banning is the moderation tool). superAdmin accounts are protected
    // by a use-case guardrail. notFoundOnDeny hides other users' existence (404 not 403).
    summary: "Delete your own account. superAdmin accounts cannot be deleted.",
    metadata: auth({
      audience: "api",
      scope: { resource: "user", selfParam: "id", notFoundOnDeny: true },
    }),
  },
});
