import type { Vote, VoteResponseEntity } from "../../entities/vote.entity.js";

export interface IVoteRepository {
  ensureIndexes(): Promise<void>;

  getVotes(params: {
    search?: string;
    status?: string;
    districtId?: string;
    creatorId?: string;
    currentUserId?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    data: Vote[];
    total: number;
    page: number;
    limit: number;
  }>;
  getVoteById(id: string, currentUserId?: string): Promise<Vote | null>;

  createVote(data: Omit<Vote, "id" | "results">): Promise<Vote>;

  updateVote(id: string, data: Partial<Omit<Vote, "id">>): Promise<Vote | null>;

  deleteVote(id: string): Promise<boolean>;

  submitResponse(data: Omit<VoteResponseEntity, "id" | "votedAt">): Promise<VoteResponseEntity>;

  clearUserResponses(voteId: string, userId: string): Promise<string[]>;

  getResults(voteId: string): Promise<{ totalResponses: number; results: { option: string; count: number }[] }>;

  hasUserVoted(voteId: string, userId: string): Promise<boolean>;
}
