import type { CreateVoteDto } from "@repo/contracts";
import type { Vote } from "../../entities/vote.entity.js";
import type { IVoteRepository } from "../../repositories/Vote/vote.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";

export const createVoteUseCase = (
  voteRepository: IVoteRepository,
  graphRepository: IGraphRepository,
) => {
  return async (data: CreateVoteDto & { creatorId: string }): Promise<Vote> => {
    const vote = await voteRepository.createVote({
      ...data,
      status: "draft",
    });

    await syncGraph(`upsertVote(${vote.id})`, () =>
      graphRepository.upsertVote({ id: vote.id, question: vote.question, endDate: vote.endDate }),
    );
    for (const districtId of vote.districtIds ?? []) {
      await syncGraph(`linkDistrictConcernsVote(${districtId}->${vote.id})`, () =>
        graphRepository.linkDistrictConcernsVote(districtId, vote.id),
      );
    }
    return vote;
  };
};
