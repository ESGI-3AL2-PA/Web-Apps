import type { Vote } from "../../entities/vote.entity.js";
import type { IVoteRepository } from "../../repositories/Vote/vote.repository.js";

// Thrown when a patch would leave the vote with endDate <= startDate. The DTO refine
// already rejects a patch carrying both bounds; this covers a patch that moves only one
// bound past the stored other.
export class VoteDateRangeError extends Error {
  constructor(message = "endDate must be after startDate") {
    super(message);
    this.name = "VoteDateRangeError";
  }
}

export const updateVoteUseCase = (voteRepository: IVoteRepository) => {
  return async (id: string, data: Partial<Omit<Vote, "id">>): Promise<Vote | null> => {
    if (data.startDate !== undefined || data.endDate !== undefined) {
      const current = await voteRepository.getVoteById(id);
      if (!current) return null;
      const startDate = data.startDate ?? current.startDate;
      const endDate = data.endDate ?? current.endDate;
      if (new Date(endDate) <= new Date(startDate)) throw new VoteDateRangeError();
    }
    return await voteRepository.updateVote(id, data);
  };
};
