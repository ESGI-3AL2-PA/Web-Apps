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

// Contrat ts-rest des conflits de synchronisation (api). Toutes les routes exigent
// audience "api" + rôle admin ou superAdmin. Les conflits de sync sont affichés et
// résolus exclusivement dans l'app desktop JavaFX (sync-gateway.md §6.5) — il n'y a
// pas de surface dans l'admin-front.
export const conflictsContract = c.router({
  // GET /sync/conflicts — admin/superAdmin. Liste les conflits de sync (ceux de sa
  // propre instance par défaut, via l'en-tête X-Sync-Instance).
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

  // GET /sync/conflicts/:id — admin/superAdmin. Récupère un conflit de sync unique.
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

  // POST /sync/conflicts/:id/resolve — admin/superAdmin. Résout un conflit en
  // choisissant la version locale, serveur ou fusionnée.
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
