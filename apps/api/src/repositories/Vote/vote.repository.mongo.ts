import { randomUUID } from "crypto";
import type { ClientSession, Collection, Db, Filter } from "mongodb";
import { toEntity, type WithMongoId } from "@repo/server-kit";
import type { Vote, VoteResponseEntity, VoteStatus } from "../../entities/vote.entity.js";
import { escapeRegex } from "../escape-regex.js";
import type { IVoteRepository } from "./vote.repository.js";

type VoteDoc = WithMongoId<Vote>;
type VoteResponseDoc = WithMongoId<VoteResponseEntity>;

export class MongoVoteRepository implements IVoteRepository {
  private votes: Collection<VoteDoc>;
  private responses: Collection<VoteResponseDoc>;

  constructor(db: Db) {
    this.votes = db.collection("votes");
    this.responses = db.collection("vote_responses");
  }

  async ensureIndexes(): Promise<void> {
    // Multikey index backing district-scoped list filtering (votes span multiple districts).
    await this.votes.createIndex({ districtIds: 1 });
  }

  async getVotes(params: {
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
  }> {
    const { search, status, districtId, creatorId, currentUserId, page = 1, limit = 20 } = params;

    const filter: Filter<VoteDoc> = {};
    if (search) filter.question = { $regex: escapeRegex(search), $options: "i" };
    if (status) filter.status = status as VoteStatus;
    if (districtId) filter.districtIds = districtId;
    if (creatorId) filter.creatorId = creatorId;

    const [total, docs] = await Promise.all([
      this.votes.countDocuments(filter),
      this.votes
        .find(filter)
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
    ]);

    const data = await this.enrichWithUserVotes(docs, currentUserId);
    return { data, total, page, limit };
  }

  async getVoteById(id: string, currentUserId?: string): Promise<Vote | null> {
    const doc = await this.votes.findOne({ _id: id });
    if (!doc) return null;
    const [enriched] = await this.enrichWithUserVotes([doc], currentUserId);
    return enriched ?? null;
  }

  private async enrichWithUserVotes(docs: VoteDoc[], currentUserId?: string): Promise<Vote[]> {
    // Group the caller's chosen options by voteId (empty map if unauthenticated).
    const byVoteId = new Map<string, string[]>();
    if (currentUserId && docs.length > 0) {
      const voteIds = docs.map((d) => d._id);
      const userResponses = await this.responses.find({ userId: currentUserId, voteId: { $in: voteIds } }).toArray();
      for (const r of userResponses) {
        const arr = byVoteId.get(r.voteId) ?? [];
        arr.push(r.chosenOption);
        byVoteId.set(r.voteId, arr);
      }
    }

    return docs.map((d) => {
      const myOptions = byVoteId.get(d._id) ?? [];
      const userHasVoted = myOptions.length > 0;
      const base = this.toVote(d);
      // Résultats aveugles : tant que l'user n'a pas voté et que le scrutin est
      // ouvert, on renvoie `totalResponses` mais on masque le détail par option
      // (compteurs mis à zéro) — sinon le classement fuite avant le vote.
      const revealBreakdown = userHasVoted || this.isVoteClosed(d);
      return {
        ...base,
        results: revealBreakdown ? base.results : base.results.map((r) => ({ ...r, count: 0 })),
        userHasVoted,
        myChosenOptions: userHasVoted ? myOptions : undefined,
      };
    });
  }

  // Un vote est clos si son statut n'est plus "open" ou si sa deadline est passée.
  private isVoteClosed(doc: VoteDoc): boolean {
    return doc.status !== "open" || new Date(doc.endDate).getTime() < Date.now();
  }

  async createVote(data: Omit<Vote, "id" | "results">): Promise<Vote> {
    const doc: VoteDoc = {
      ...data,
      _id: randomUUID(),
      results: data.options.map((option) => ({ option, count: 0 })),
    };
    await this.votes.insertOne(doc);
    return this.toVote(doc);
  }

  async updateVote(id: string, data: Partial<Omit<Vote, "id">>): Promise<Vote | null> {
    const result = await this.votes.findOneAndUpdate({ _id: id }, { $set: { ...data } }, { returnDocument: "after" });
    return result ? this.toVote(result) : null;
  }

  async deleteVote(id: string): Promise<boolean> {
    const [voteResult] = await Promise.all([
      this.votes.deleteOne({ _id: id }),
      this.responses.deleteMany({ voteId: id }),
    ]);
    return voteResult.deletedCount === 1;
  }

  async submitResponse(
    data: Omit<VoteResponseEntity, "id" | "votedAt">,
    session?: ClientSession,
  ): Promise<VoteResponseEntity> {
    const now = new Date().toISOString();
    const doc: VoteResponseDoc = { ...data, _id: randomUUID(), votedAt: now };
    await this.responses.insertOne(doc, { session });

    // Increment the matching option in the vote's cached results
    await this.votes.updateOne(
      { _id: data.voteId, "results.option": data.chosenOption },
      { $inc: { "results.$.count": 1 } },
      { session },
    );

    return toEntity<VoteResponseEntity>(doc);
  }

  async clearUserResponses(voteId: string, userId: string, session?: ClientSession): Promise<string[]> {
    const existing = await this.responses.find({ voteId, userId }, { session }).toArray();
    if (existing.length === 0) return [];

    const options = existing.map((r) => r.chosenOption);
    await this.responses.deleteMany({ voteId, userId }, { session });

    // Décrémente les compteurs pour chaque option précédemment votée.
    for (const option of options) {
      await this.votes.updateOne(
        { _id: voteId, "results.option": option },
        { $inc: { "results.$.count": -1 } },
        { session },
      );
    }

    return options;
  }

  async deleteUserResponses(userId: string): Promise<void> {
    const existing = await this.responses.find({ userId }).toArray();
    if (existing.length === 0) return;
    await this.responses.deleteMany({ userId });
    // Décrémente les compteurs de résultats pour chaque (vote, option) retiré.
    for (const r of existing) {
      await this.votes.updateOne(
        { _id: r.voteId, "results.option": r.chosenOption },
        { $inc: { "results.$.count": -1 } },
      );
    }
  }

  async getResults(voteId: string): Promise<{ totalResponses: number; results: { option: string; count: number }[] }> {
    const [totalResponses, agg] = await Promise.all([
      this.responses.countDocuments({ voteId }),
      this.responses
        .aggregate<{
          _id: string;
          count: number;
        }>([{ $match: { voteId } }, { $group: { _id: "$chosenOption", count: { $sum: 1 } } }])
        .toArray(),
    ]);
    return {
      totalResponses,
      results: agg.map(({ _id, count }) => ({ option: _id, count })),
    };
  }

  async hasUserVoted(voteId: string, userId: string): Promise<boolean> {
    const existing = await this.responses.findOne({ voteId, userId });
    return existing !== null;
  }

  private toVote(doc: VoteDoc): Vote {
    const { _id, ...rest } = doc;
    const totalResponses = rest.results.reduce((sum, r) => sum + r.count, 0);
    return { id: _id, ...rest, totalResponses };
  }
}
