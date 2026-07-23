import type { IVoteRepository } from "../../repositories/Vote/vote.repository.js";

/**
 * Cas d'usage (domaine votes) : liste paginée de votes / sondages, avec filtres optionnels
 * par recherche texte, statut, quartier et créateur. `currentUserId` permet d'enrichir chaque
 * entrée avec la réponse de l'appelant. Simple pass-through vers le repository.
 */
export const getVotesUseCase = (voteRepository: IVoteRepository) => {
  return async (params: {
    search?: string;
    status?: string;
    districtId?: string;
    creatorId?: string;
    currentUserId?: string;
    page?: number;
    limit?: number;
  }) => {
    return await voteRepository.getVotes(params);
  };
};
