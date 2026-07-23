import type { IVoteRepository } from "../../repositories/Vote/vote.repository.js";

/**
 * Cas d'usage (domaine votes) : agrège les résultats d'un vote / sondage (nombre total de
 * réponses + décompte par option). Renvoie `null` si le vote n'existe pas.
 */
export const getVoteResultsUseCase = (voteRepository: IVoteRepository) => {
  return async (voteId: string) => {
    // On vérifie d'abord l'existence du vote pour distinguer « pas de résultats » d'un 404.
    const vote = await voteRepository.getVoteById(voteId);
    if (!vote) return null;

    const { totalResponses, results } = await voteRepository.getResults(voteId);
    return { voteId, totalResponses, results };
  };
};
