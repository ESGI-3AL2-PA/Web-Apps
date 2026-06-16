import type { SubmitVoteResponseDto } from "@repo/contracts";
import type { Vote } from "../../entities/vote.entity.js";
import type { IVoteRepository } from "../../repositories/Vote/vote.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";

export const submitVoteResponseUseCase = (
  voteRepository: IVoteRepository,
  graphRepository: IGraphRepository,
) => {
  return async (
    voteId: string,
    userId: string,
    data: SubmitVoteResponseDto,
  ): Promise<{ vote: Vote | null; alreadyVoted: boolean }> => {
    const vote = await voteRepository.getVoteById(voteId);
    if (!vote) return { vote: null, alreadyVoted: false };

    const already = await voteRepository.hasUserVoted(voteId, userId);
    if (already) return { vote, alreadyVoted: true };

    await voteRepository.submitResponse({
      voteId,
      userId,
      chosenOption: data.chosenOption,
    });

    // Mirror the vote act into the graph (drives recommendations later).
    const now = new Date().toISOString();
    await syncGraph(`linkUserVoted(${userId}->${voteId})`, () =>
      graphRepository.linkUserVoted(userId, voteId, data.chosenOption, now),
    );

    const refreshed = await voteRepository.getVoteById(voteId);
    return { vote: refreshed, alreadyVoted: false };
  };
};
