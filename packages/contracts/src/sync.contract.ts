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

// The desktop client authenticates with its operator's own access token (no shared
// secret). Both directions are additionally district-scoped in the handlers — see
// sync-gateway.md §5.5 / Decision D1.
export const syncContract = c.router({
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
