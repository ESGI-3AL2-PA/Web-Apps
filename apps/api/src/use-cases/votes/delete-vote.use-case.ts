import type { IVoteRepository } from "../../repositories/Vote/vote.repository.js";

export const deleteVoteUseCase = (voteRepository: IVoteRepository) => {
  return async (params: { id: string }): Promise<boolean> => {
    return await voteRepository.deleteVote(params.id);
  };
};
