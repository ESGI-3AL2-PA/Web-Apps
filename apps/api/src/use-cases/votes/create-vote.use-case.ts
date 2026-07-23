import type { CreateVoteDto } from "@repo/contracts";
import type { Vote } from "../../entities/vote.entity.js";
import type { IVoteRepository } from "../../repositories/Vote/vote.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";

/**
 * Cas d'usage (domaine votes) : crée un vote / sondage. Le vote naît toujours au statut
 * `draft` (l'appelant ne choisit pas le statut initial). Après persistance, le vote est
 * projeté dans le graphe Neo4j et relié (best-effort) à chacun des quartiers concernés.
 */
export const createVoteUseCase = (voteRepository: IVoteRepository, graphRepository: IGraphRepository) => {
  return async (data: CreateVoteDto & { creatorId: string }): Promise<Vote> => {
    const vote = await voteRepository.createVote({
      ...data,
      status: "draft",
    });

    // Projection du vote dans le graphe.
    await syncGraph(`upsertVote(${vote.id})`, () =>
      graphRepository.upsertVote({ id: vote.id, question: vote.question, endDate: vote.endDate }),
    );
    // Une arête DISTRICT_CONCERNS_VOTE par quartier ciblé par le vote.
    for (const districtId of vote.districtIds ?? []) {
      await syncGraph(`linkDistrictConcernsVote(${districtId}->${vote.id})`, () =>
        graphRepository.linkDistrictConcernsVote(districtId, vote.id),
      );
    }
    return vote;
  };
};
