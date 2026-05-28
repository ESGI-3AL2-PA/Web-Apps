import type { Vote } from "../../entities/vote.entity.js";
import type { IVoteRepository } from "../../repositories/Vote/vote.repository.js";

export const updateVoteUseCase = (voteRepository: IVoteRepository) => {
  return async (id: string, data: Partial<Omit<Vote, "id">>): Promise<Vote | null> => {
    return await voteRepository.updateVote(id, data);
  };
};
