import { quote, type SatanClient } from "@repo/satan";
import type { ClientSession } from "mongodb";
import type { Vote, VoteResponseEntity } from "../../entities/vote.entity.js";
import type { IVoteRepository } from "./vote.repository.js";

/**
 * Implémentation SATAN QL du repository des votes / sondages (couche repository).
 *
 * Enveloppe l'implémentation Mongo : seul le test d'existence « a voté »
 * (voteId, userId) passe par SATAN QL. Les lectures enrichissent chaque vote de
 * l'état par utilisateur et les écritures entretiennent les compteurs
 * `results[]` en cache à travers deux collections — tout cela dépasse une
 * requête scalaire, donc reste délégué à Mongo.
 */
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

  // --- délégué à Mongo ---
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
