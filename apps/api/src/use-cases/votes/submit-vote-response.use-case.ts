import type { SubmitVoteResponseDto } from "@repo/contracts";
import type { Vote } from "../../entities/vote.entity.js";
import type { IVoteRepository } from "../../repositories/Vote/vote.repository.js";

export const submitVoteResponseUseCase = (voteRepository: IVoteRepository) => {
  return async (
    voteId: string,
    data: SubmitVoteResponseDto,
  ): Promise<{ vote: Vote | null; alreadyVoted: boolean }> => {
    const vote = await voteRepository.getVoteById(voteId);
    if (!vote) return { vote: null, alreadyVoted: false };

    const already = await voteRepository.hasUserVoted(voteId, data.userId);
    if (already) return { vote, alreadyVoted: true };

    await voteRepository.submitResponse({
      voteId,
      userId: data.userId,
      chosenOption: data.chosenOption,
    });

    const refreshed = await voteRepository.getVoteById(voteId);
    return { vote: refreshed, alreadyVoted: false };
  };
};
