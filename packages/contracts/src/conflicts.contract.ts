import { initContract } from "@ts-rest/core";
import { z } from "zod";

import {
  ConflictDtoSchema,
  ConflictParamsDtoSchema,
  ConflictQueryDtoSchema,
  ResolveConflictDtoSchema,
  ResolveConflictResponseDtoSchema,
  SyncInstanceHeaderSchema,
  BadRequestErrorSchema,
  ForbiddenErrorSchema,
  NotFoundErrorSchema,
} from "./DTO";
import { auth } from "./auth-meta";

const c = initContract();

// Sync conflicts are surfaced and resolved exclusively in the JavaFX desktop app
// (sync-gateway.md §6.5) — there is no admin-front surface.
export const conflictsContract = c.router({
  getConflicts: {
    method: "GET",
    path: "/sync/conflicts",
    headers: SyncInstanceHeaderSchema,
    query: ConflictQueryDtoSchema,
    responses: {
      200: z.array(ConflictDtoSchema),
      403: ForbiddenErrorSchema,
    },
    summary: "List sync conflicts (own instance's by default)",
    metadata: auth({ audience: "api", roles: ["admin", "superAdmin"] }),
  },

  getConflictById: {
    method: "GET",
    path: "/sync/conflicts/:id",
    pathParams: ConflictParamsDtoSchema,
    responses: {
      200: ConflictDtoSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Get a single sync conflict",
    metadata: auth({ audience: "api", roles: ["admin", "superAdmin"] }),
  },

  resolveConflict: {
    method: "POST",
    path: "/sync/conflicts/:id/resolve",
    pathParams: ConflictParamsDtoSchema,
    body: ResolveConflictDtoSchema,
    responses: {
      200: ResolveConflictResponseDtoSchema,
      400: BadRequestErrorSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Resolve a sync conflict (local / server / merged)",
    metadata: auth({ audience: "api", roles: ["admin", "superAdmin"] }),
  },
});
