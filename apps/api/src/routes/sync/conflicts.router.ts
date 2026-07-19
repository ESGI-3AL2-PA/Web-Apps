import { initServer } from "@ts-rest/express";
import { conflictsContract } from "@repo/contracts";
import { resolve } from "../../repositories/container.js";
import { getConflictByIdUseCase, getConflictsUseCase } from "../../use-cases/sync/get-conflicts.use-case.js";
import { resolveConflictUseCase } from "../../use-cases/sync/resolve-conflict.use-case.js";

const s = initServer();

const resolveDeps = () => ({
  writer: resolve("syncWriter"),
  conflicts: resolve("syncConflicts"),
  graph: resolve("graph"),
});

export const conflictsRouter = s.router(conflictsContract, {
  getConflicts: async ({ query, headers, req }) => {
    // The full view is the superAdmin escape hatch for conflicts raised by an
    // instance that never came back online (§6.5); everyone else sees their own.
    if (!query.mine && req.user!.role !== "superAdmin") {
      return { status: 403, body: { message: "Only a superAdmin may list other instances' conflicts" } };
    }
    const conflicts = await getConflictsUseCase(resolve("syncConflicts"))({
      status: query.status,
      entity: query.entity,
      originInstanceId: query.mine ? headers["x-sync-instance"] : undefined,
      limit: query.limit,
    });
    return { status: 200, body: conflicts };
  },

  getConflictById: async ({ params: { id } }) => {
    const conflict = await getConflictByIdUseCase(resolve("syncConflicts"))(id);
    if (!conflict) return { status: 404, body: { message: "Conflict not found" } };
    return { status: 200, body: conflict };
  },

  resolveConflict: async ({ params: { id }, body, req }) => {
    const result = await resolveConflictUseCase(resolveDeps())(id, body, req.user!.sub);
    if (result.kind === "not-found") return { status: 404, body: { message: "Conflict not found" } };
    if (result.kind === "already-resolved") {
      return { status: 400, body: { message: "Conflict is already resolved" } };
    }
    return { status: 200, body: { id, status: "resolved", resolution: result.resolution } };
  },
});
