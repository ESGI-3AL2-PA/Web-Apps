import { quote, type SatanClient } from "@repo/satan";
import type { ClientSession } from "mongodb";
import type { Vote, VoteResponseEntity } from "../../entities/vote.entity.js";
import type { IVoteRepository } from "./vote.repository.js";

/** SATAN QL for the (voteId, userId) has-voted existence check. Reads enrich
 *  with per-user state, writes maintain cached `results[]` counts across two
 *  collections — all beyond a scalar QL, so they stay on Mongo. */
export class SatanVoteRepository implements IVoteRepository {
  constructor(
    private readonly mongo: IVoteRepository,
    private readonly satan: SatanClient,
  ) {}

  async hasUserVoted(voteId: string, userId: string): Promise<boolean> {
    const rows = (await this.satan.query(
      `FIND vote_responses WHERE voteId = ${quote(voteId)} AND userId = ${quote(userId)}`,
    )) as unknown[];
    return rows.length > 0;
  }

  // --- delegated to Mongo ---
  ensureIndexes(): Promise<void> {
    return this.mongo.ensureIndexes();
  }
  getVotes(params: Parameters<IVoteRepository["getVotes"]>[0]) {
    return this.mongo.getVotes(params);
  }
  getVoteById(id: string, currentUserId?: string): Promise<Vote | null> {
    return this.mongo.getVoteById(id, currentUserId);
  }
  createVote(data: Omit<Vote, "id" | "results">): Promise<Vote> {
    return this.mongo.createVote(data);
  }
  updateVote(id: string, data: Partial<Omit<Vote, "id">>): Promise<Vote | null> {
    return this.mongo.updateVote(id, data);
  }
  deleteVote(id: string): Promise<boolean> {
    return this.mongo.deleteVote(id);
  }
  submitResponse(
    data: Omit<VoteResponseEntity, "id" | "votedAt">,
    session?: ClientSession,
  ): Promise<VoteResponseEntity> {
    return this.mongo.submitResponse(data, session);
  }
  clearUserResponses(voteId: string, userId: string, session?: ClientSession): Promise<string[]> {
    return this.mongo.clearUserResponses(voteId, userId, session);
  }
  deleteUserResponses(userId: string): Promise<void> {
    return this.mongo.deleteUserResponses(userId);
  }
  getResults(voteId: string) {
    return this.mongo.getResults(voteId);
  }
}
