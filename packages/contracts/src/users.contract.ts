import { initContract } from "@ts-rest/core";
import { z } from "zod";

import {
  BadGatewayErrorSchema,
  BanUserDtoSchema,
  ConflictErrorSchema,
  CreateUserDtoSchema,
  DistrictResponseDtoSchema,
  ForbiddenErrorSchema,
  NotFoundErrorSchema,
  ResolveDistrictRequestDtoSchema,
  ResolveDistrictResponseDtoSchema,
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
      409: ConflictErrorSchema,
    },
    summary: "Partially update a user (self or admin)",
    metadata: auth({
      audience: "api",
      scope: { resource: "user", selfParam: "id", bypassRoles: ["superAdmin"] },
      // Identity/recovery + district-moving fields require a fresh TOTP step-up in production.
      stepUp: { whenBodyTouches: ["email", "address", "newPassword"] },
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

  kickFromDistrict: {
    method: "POST",
    path: "/users/:id/kick",
    pathParams: UserParamsDtoSchema,
    body: c.noBody(),
    responses: {
      200: UserResponseDtoSchema,
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
    },
    // Distinct from ban: removes a regular user from their district and redistributes
    // their balance to the remaining members. Does NOT set `banned`. Admins scoped to
    // their district; superAdmin any (same policy as banUser).
    summary: "Kick a regular user from their district, redistributing their points to the remaining members.",
    metadata: auth({
      audience: "api",
      roles: ["admin", "superAdmin"],
      scope: { resource: "user", districtField: "districtId", bypassRoles: ["superAdmin"] },
    }),
  },

  resolveMyDistrict: {
    method: "POST",
    path: "/users/me/resolve-district",
    body: ResolveDistrictRequestDtoSchema,
    responses: {
      200: ResolveDistrictResponseDtoSchema,
    },
    // Re-geocode the caller's stored address and, if exactly one district contains them
    // (or the caller picks one among several via body.districtId) and they are
    // district-less, join it (granting its starting points). Used by the onboarding
    // "check again" / district-picker affordance. Any authenticated user, self-scoped to sub.
    summary: "Resolve and join the district containing your address (self).",
    metadata: auth({ audience: "api" }),
  },

  createOwnDistrict: {
    method: "POST",
    path: "/users/me/district",
    body: c.noBody(),
    responses: {
      201: DistrictResponseDtoSchema,
      // Already have a district / not a plain user, or the address couldn't be geocoded.
      409: ConflictErrorSchema,
    },
    // Self-service onboarding: a district-less user creates an active district over their
    // geocoded address (placeholder box + temp name) and is promoted to its admin. The
    // client then redirects them into the admin app to refine it. The use-case enforces
    // role==="user" && no districtId.
    summary: "Create your own district from your address and become its admin (self).",
    metadata: auth({ audience: "api" }),
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
      // Account data was erased locally but a downstream dependency (auth-service
      // session purge) did not complete — erasure is only partial. Surfaced instead
      // of a false 204 so the caller knows to retry (GDPR Art. 17).
      502: BadGatewayErrorSchema,
    },
    // Self-service account deletion (GDPR erasure): a user may delete ONLY their own
    // account — selfParam:"id", no superAdmin bypass (admins can't delete others via
    // this route; banning is the moderation tool). superAdmin accounts are protected
    // by a use-case guardrail. notFoundOnDeny hides other users' existence (404 not 403).
    summary: "Delete your own account. superAdmin accounts cannot be deleted.",
    metadata: auth({
      audience: "api",
      scope: { resource: "user", selfParam: "id", notFoundOnDeny: true },
      stepUp: { always: true },
    }),
  },
});
