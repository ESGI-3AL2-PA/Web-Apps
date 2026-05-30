import type { IVoteRepository } from "../../repositories/Vote/vote.repository.js";

export const getVoteResultsUseCase = (voteRepository: IVoteRepository) => {
  return async (voteId: string) => {
    const vote = await voteRepository.getVoteById(voteId);
    if (!vote) return null;

    const { totalResponses, results } = await voteRepository.getResults(voteId);
    return { voteId, totalResponses, results };
  };
};
