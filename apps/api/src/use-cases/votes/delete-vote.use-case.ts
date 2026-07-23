import type { IVoteRepository } from "../../repositories/Vote/vote.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";

/**
 * Cas d'usage (domaine votes) : supprime un vote / sondage. Le nœud correspondant n'est retiré
 * du graphe Neo4j (best-effort) que si la suppression en base a bien eu lieu. Renvoie `false`
 * si aucun vote ne correspondait à l'id.
 */
export const deleteVoteUseCase = (voteRepository: IVoteRepository, graphRepository: IGraphRepository) => {
  return async (params: { id: string }): Promise<boolean> => {
    const deleted = await voteRepository.deleteVote(params.id);
    if (deleted) {
      await syncGraph(`deleteVote(${params.id})`, () => graphRepository.deleteVote(params.id));
    }
    return deleted;
  };
};
