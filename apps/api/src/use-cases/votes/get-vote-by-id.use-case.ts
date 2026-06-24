import type { IVoteRepository } from "../../repositories/Vote/vote.repository.js";

export const getVoteByIdUseCase = (voteRepository: IVoteRepository) => {
  return async (params: { id: string; currentUserId?: string }) => {
    return await voteRepository.getVoteById(params.id, params.currentUserId);
  };
};
