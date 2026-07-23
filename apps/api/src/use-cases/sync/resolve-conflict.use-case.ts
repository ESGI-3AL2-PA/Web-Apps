// Cas d'usage sync : applique la décision d'un opérateur sur un conflit en quarantaine.
import type { ResolveConflictDto } from "@repo/contracts";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import type { ISyncConflictsRepository } from "../../repositories/Sync/sync-conflicts.repository.js";
import type { ISyncWriterRepository } from "../../repositories/Sync/sync-writer.repository.js";
import { projectSyncWrite } from "../../sync/graph-projection.js";

/** Issues possibles : conflit introuvable, déjà résolu, ou résolu avec la résolution appliquée. */
export type ResolveConflictResult =
  | { kind: "not-found" }
  | { kind: "already-resolved" }
  | { kind: "resolved"; resolution: ResolveConflictDto["resolution"] };

/** Dépendances : writer Mongo, repository des conflits, projection graphe. */
export interface ResolveConflictDeps {
  writer: ISyncWriterRepository;
  conflicts: ISyncConflictsRepository;
  graph: IGraphRepository;
}

/**
 * Applique la décision d'un opérateur depuis l'UI de conflits du desktop (§6.3).
 * L'écriture résultante est estampillée comme d'origine serveur (`_sync` effacé), pour
 * que le watcher la publie à *chaque* instance — y compris celle qui a levé le conflit,
 * qui a besoin de ce pull pour vider sa ligne en attente (§6.5).
 *
 * `resolution` vaut `server` (garder le doc serveur), `local` (appliquer le snapshot
 * local capturé) ou `merged` (appliquer les données fusionnées fournies par l'opérateur).
 */
export const resolveConflictUseCase = ({ writer, conflicts, graph }: ResolveConflictDeps) => {
  return async (id: string, body: ResolveConflictDto, resolvedBy: string): Promise<ResolveConflictResult> => {
    const conflict = await conflicts.getById(id);
    if (!conflict) return { kind: "not-found" };
    if (conflict.status !== "pending") return { kind: "already-resolved" };

    const { entity, mongoId } = conflict;

    // On revendique le conflit AVANT d'écrire : ce basculement est le garde atomique,
    // donc une seconde résolution (ou une résolution concurrente ayant passé le test
    // ci-dessus) perd ici et n'écrase jamais la décision du premier opérateur.
    const marked = await conflicts.markResolved(id, body.resolution, resolvedBy);
    if (!marked) return { kind: "already-resolved" };

    if (body.resolution === "server") {
      // On garde le doc serveur ; on le re-propage pour que chaque instance reconverge.
      await writer.touch(entity, mongoId);
    } else {
      const data = body.resolution === "merged" ? body.data! : conflict.localData;
      const updated = await writer.update(entity, mongoId, data, null);
      // L'enregistrement a été supprimé sous le conflit — on le recrée à partir de la décision.
      if (!updated) await writer.insert(entity, data, null, mongoId);
    }

    const doc = await writer.findById(entity, mongoId);
    await projectSyncWrite(graph, entity, "UPDATE", mongoId, doc);

    return { kind: "resolved", resolution: body.resolution };
  };
};
