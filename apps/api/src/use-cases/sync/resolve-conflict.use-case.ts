import type { ResolveConflictDto } from "@repo/contracts";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import type { ISyncConflictsRepository } from "../../repositories/Sync/sync-conflicts.repository.js";
import type { ISyncWriterRepository } from "../../repositories/Sync/sync-writer.repository.js";
import { projectSyncWrite } from "../../sync/graph-projection.js";

export type ResolveConflictResult =
  | { kind: "not-found" }
  | { kind: "already-resolved" }
  | { kind: "resolved"; resolution: ResolveConflictDto["resolution"] };

export interface ResolveConflictDeps {
  writer: ISyncWriterRepository;
  conflicts: ISyncConflictsRepository;
  graph: IGraphRepository;
}

/**
 * Applies an operator's decision from the desktop conflict UI (§6.3). The resulting
 * write is stamped as server-origin (`_sync` cleared), so the watcher publishes it to
 * *every* instance — including the one that raised the conflict, which needs the pull
 * to clear its pending row (§6.5).
 */
export const resolveConflictUseCase = ({ writer, conflicts, graph }: ResolveConflictDeps) => {
  return async (id: string, body: ResolveConflictDto, resolvedBy: string): Promise<ResolveConflictResult> => {
    const conflict = await conflicts.getById(id);
    if (!conflict) return { kind: "not-found" };
    if (conflict.status !== "pending") return { kind: "already-resolved" };

    const { entity, mongoId } = conflict;

    if (body.resolution === "server") {
      // Keep the server doc; re-propagate it so every instance reconverges.
      await writer.touch(entity, mongoId);
    } else {
      const data = body.resolution === "merged" ? body.data! : conflict.localData;
      const updated = await writer.update(entity, mongoId, data, null);
      // The record was deleted underneath the conflict — recreate it from the decision.
      if (!updated) await writer.insert(entity, data, null, mongoId);
    }

    // Guarded flip: a concurrent second resolve finds no pending row and bows out.
    const marked = await conflicts.markResolved(id, body.resolution, resolvedBy);
    if (!marked) return { kind: "already-resolved" };

    const doc = await writer.findById(entity, mongoId);
    await projectSyncWrite(graph, entity, "UPDATE", mongoId, doc);

    return { kind: "resolved", resolution: body.resolution };
  };
};
