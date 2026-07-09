import { randomUUID } from "crypto";
import type { Collection, Db, Filter } from "mongodb";
import type { Vote, VoteResponseEntity, VoteStatus } from "../../entities/vote.entity.js";
import type { IVoteRepository } from "./vote.repository.js";

type VoteDoc = Omit<Vote, "id"> & { _id: string };
type VoteResponseDoc = Omit<VoteResponseEntity, "id"> & { _id: string };

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
    if (search) filter.question = { $regex: search, $options: "i" };
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
    if (!currentUserId || docs.length === 0) {
      return docs.map(this.toVote);
    }

    const voteIds = docs.map((d) => d._id);
    const userResponses = await this.responses.find({ userId: currentUserId, voteId: { $in: voteIds } }).toArray();

    // Group options by voteId
    const byVoteId = new Map<string, string[]>();
    for (const r of userResponses) {
      const arr = byVoteId.get(r.voteId) ?? [];
      arr.push(r.chosenOption);
      byVoteId.set(r.voteId, arr);
    }

    return docs.map((d) => {
      const myOptions = byVoteId.get(d._id) ?? [];
      const base = this.toVote(d);
      return {
        ...base,
        userHasVoted: myOptions.length > 0,
        myChosenOptions: myOptions.length > 0 ? myOptions : undefined,
      };
    });
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

  async submitResponse(data: Omit<VoteResponseEntity, "id" | "votedAt">): Promise<VoteResponseEntity> {
    const now = new Date().toISOString();
    const doc: VoteResponseDoc = { ...data, _id: randomUUID(), votedAt: now };
    await this.responses.insertOne(doc);

    // Increment the matching option in the vote's cached results
    await this.votes.updateOne(
      { _id: data.voteId, "results.option": data.chosenOption },
      { $inc: { "results.$.count": 1 } },
    );

    return this.toVoteResponse(doc);
  }

  async clearUserResponses(voteId: string, userId: string): Promise<string[]> {
    const existing = await this.responses.find({ voteId, userId }).toArray();
    if (existing.length === 0) return [];

    const options = existing.map((r) => r.chosenOption);
    await this.responses.deleteMany({ voteId, userId });

    // Décrémente les compteurs pour chaque option précédemment votée.
    for (const option of options) {
      await this.votes.updateOne({ _id: voteId, "results.option": option }, { $inc: { "results.$.count": -1 } });
    }

    return options;
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
    return { id: _id, ...rest };
  }

  private toVoteResponse(doc: VoteResponseDoc): VoteResponseEntity {
    const { _id, ...rest } = doc;
    return { id: _id, ...rest };
  }
}
