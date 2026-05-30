import { initServer } from "@ts-rest/express";
import { votesContract } from "@repo/contracts";
import { resolve } from "../../repositories/container.js";
import { getVotesUseCase } from "../../use-cases/votes/get-votes.use-case.js";
import { getVoteByIdUseCase } from "../../use-cases/votes/get-vote-by-id.use-case.js";
import { createVoteUseCase } from "../../use-cases/votes/create-vote.use-case.js";
import { updateVoteUseCase } from "../../use-cases/votes/update-vote.use-case.js";
import { deleteVoteUseCase } from "../../use-cases/votes/delete-vote.use-case.js";
import { submitVoteResponseUseCase } from "../../use-cases/votes/submit-vote-response.use-case.js";
import { getVoteResultsUseCase } from "../../use-cases/votes/get-vote-results.use-case.js";

const s = initServer();

export const votesRouter = s.router(votesContract, {
  getVotes: async ({ query }) => {
    const result = await getVotesUseCase(resolve("vote"))(query);
    return { status: 200, body: result };
  },

  getVoteById: async ({ params: { id } }) => {
    const vote = await getVoteByIdUseCase(resolve("vote"))({ id });
    if (!vote) {
      return { status: 404, body: { message: "Vote not found" } };
    }
    return { status: 200, body: vote };
  },

  createVote: async ({ body }) => {
    // TODO: get creatorId from authenticated user
    const newVote = await createVoteUseCase(resolve("vote"))({
      ...body,
      creatorId: "",
    });
    return { status: 201, body: newVote };
  },

  updateVote: async ({ params: { id }, body }) => {
    const vote = await updateVoteUseCase(resolve("vote"))(id, body);
    if (!vote) {
      return { status: 404, body: { message: "Vote not found" } };
    }
    return { status: 200, body: vote };
  },

  deleteVote: async ({ params: { id } }) => {
    const deleted = await deleteVoteUseCase(resolve("vote"))({ id });
    if (!deleted) {
      return { status: 404, body: { message: "Vote not found" } };
    }
    return { status: 204, body: undefined };
  },

  submitVoteResponse: async ({ params: { id }, body }) => {
    const { vote, alreadyVoted } = await submitVoteResponseUseCase(resolve("vote"))(id, body);
    if (!vote) {
      return { status: 404, body: { message: "Vote not found" } };
    }
    if (alreadyVoted) {
      // Idempotent for now: return the current vote without incrementing again
      return { status: 200, body: vote };
    }
    return { status: 200, body: vote };
  },

  getVoteResults: async ({ params: { id } }) => {
    const results = await getVoteResultsUseCase(resolve("vote"))(id);
    if (!results) {
      return { status: 404, body: { message: "Vote not found" } };
    }
    return { status: 200, body: results };
  },
});
