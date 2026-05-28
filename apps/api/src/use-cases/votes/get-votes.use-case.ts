import type { IVoteRepository } from "../../repositories/Vote/vote.repository.js";

export const getVotesUseCase = (voteRepository: IVoteRepository) => {
  return async (params: {
    search?: string;
    status?: string;
    districtId?: string;
    creatorId?: string;
    page?: number;
    limit?: number;
  }) => {
    return await voteRepository.getVotes(params);
  };
};
