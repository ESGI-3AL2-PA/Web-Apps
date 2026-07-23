import { initContract } from "@ts-rest/core";
import { z } from "zod";

import {
  ChangeEntryDtoSchema,
  ChangesQueryDtoSchema,
  IngestBatchDtoSchema,
  IngestResultDtoSchema,
  SyncInstanceHeaderSchema,
  BadRequestErrorSchema,
} from "./DTO";
import { auth } from "./auth-meta";

const c = initContract();

/**
 * Contract ts-rest de la synchronisation hors-ligne (client desktop).
 *
 * Le client desktop s'authentifie avec l'access token de son opérateur (pas de
 * secret partagé) ; les deux routes exigent donc le rôle admin ou superAdmin.
 * Les deux directions sont en outre limitées au quartier dans les handlers —
 * voir sync-gateway.md §5.5 / Décision D1.
 */
export const syncContract = c.router({
  // POST /sync/ingest — applique un lot d'événements hors-ligne poussés par une instance desktop. Admin/superAdmin.
  ingest: {
    method: "POST",
    path: "/sync/ingest",
    headers: SyncInstanceHeaderSchema,
    body: IngestBatchDtoSchema,
    responses: {
      200: IngestResultDtoSchema,
      400: BadRequestErrorSchema,
    },
    summary: "Apply a batch of offline events pushed by a desktop instance",
    metadata: auth({ audience: "api", roles: ["admin", "superAdmin"] }),
  },

  // GET /sync/changes — interroge le flux ordonné des changements à appliquer localement. Admin/superAdmin.
  getChanges: {
    method: "GET",
    path: "/sync/changes",
    headers: SyncInstanceHeaderSchema,
    query: ChangesQueryDtoSchema,
    responses: {
      200: z.array(ChangeEntryDtoSchema),
    },
    summary: "Poll the ordered change feed for records to apply locally",
    metadata: auth({ audience: "api", roles: ["admin", "superAdmin"] }),
  },
});
