import { initServer } from "@ts-rest/express";
import { syncContract } from "@repo/contracts";
import { resolve } from "../../repositories/container.js";
import { resolveSyncScope } from "../../sync/sync-scope.js";
import { ingestUseCase } from "../../use-cases/sync/ingest.use-case.js";
import { getChangesUseCase } from "../../use-cases/sync/get-changes.use-case.js";

const s = initServer();

export const syncRouter = s.router(syncContract, {
  ingest: async ({ body, headers, req }) => {
    const scope = await resolveSyncScope(req.user!, resolve("user"));
    const result = await ingestUseCase({
      writer: resolve("syncWriter"),
      conflicts: resolve("syncConflicts"),
      graph: resolve("graph"),
    })({ events: body, instanceId: headers["x-sync-instance"], scope });
    return { status: 200, body: result };
  },

  getChanges: async ({ query, headers, req }) => {
    const scope = await resolveSyncScope(req.user!, resolve("user"));
    const changes = await getChangesUseCase(resolve("syncChanges"))({
      since: query.since,
      limit: query.limit,
      // Echo-skip: an instance never needs to see its own writes back — it already
      // learned the new updatedAt from the ingest ack (§7).
      excludeInstance: headers["x-sync-instance"],
      scope,
    });
    return { status: 200, body: changes };
  },
});
