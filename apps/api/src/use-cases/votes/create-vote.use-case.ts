import type { CreateVoteDto } from "@repo/contracts";
import type { Vote } from "../../entities/vote.entity.js";
import type { IVoteRepository } from "../../repositories/Vote/vote.repository.js";

export const createVoteUseCase = (voteRepository: IVoteRepository) => {
  return async (data: CreateVoteDto & { creatorId: string }): Promise<Vote> => {
    return await voteRepository.createVote({
      ...data,
      status: "draft",
    });
  };
};
