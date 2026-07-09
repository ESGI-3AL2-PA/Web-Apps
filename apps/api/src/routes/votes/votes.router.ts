import { initServer } from "@ts-rest/express";
import { votesContract } from "@repo/contracts";
import { resolve } from "../../repositories/container.js";
import { resolveListDistrictScope } from "../../middleware/district-scope.js";
import { getVotesUseCase } from "../../use-cases/votes/get-votes.use-case.js";
import { getVoteByIdUseCase } from "../../use-cases/votes/get-vote-by-id.use-case.js";
import { createVoteUseCase } from "../../use-cases/votes/create-vote.use-case.js";
import { updateVoteUseCase } from "../../use-cases/votes/update-vote.use-case.js";
import { deleteVoteUseCase } from "../../use-cases/votes/delete-vote.use-case.js";
import {
  submitVoteResponseUseCase,
  InvalidVoteSubmissionError,
  VoteDistrictForbiddenError,
} from "../../use-cases/votes/submit-vote-response.use-case.js";
import { getVoteResultsUseCase } from "../../use-cases/votes/get-vote-results.use-case.js";

const s = initServer();

export const votesRouter = s.router(votesContract, {
  getVotes: async ({ query, req }) => {
    const scope = resolveListDistrictScope(req.user!, query.districtId);
    if ("empty" in scope) {
      return { status: 200, body: { data: [], total: 0, page: query.page, limit: query.limit } };
    }
    // On passe l'ID du user authentifié pour que la repo peuple
    // `userHasVoted` / `myChosenOptions` sur chaque vote renvoyé.
    const result = await getVotesUseCase(resolve("vote"))({
      ...query,
      districtId: scope.districtId,
      currentUserId: req.user?.sub,
    });
    return { status: 200, body: result };
  },

  getVoteById: async ({ params: { id }, req }) => {
    const vote = await getVoteByIdUseCase(resolve("vote"))({ id, currentUserId: req.user?.sub });
    if (!vote) {
      return { status: 404, body: { message: "Vote not found" } };
    }
    return { status: 200, body: vote };
  },

  createVote: async ({ body, req }) => {
    const newVote = await createVoteUseCase(
      resolve("vote"),
      resolve("graph"),
    )({
      ...body,
      creatorId: req.user!.sub,
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
    const deleted = await deleteVoteUseCase(resolve("vote"), resolve("graph"))({ id });
    if (!deleted) {
      return { status: 404, body: { message: "Vote not found" } };
    }
    return { status: 204, body: undefined };
  },

  submitVoteResponse: async ({ params: { id }, body, req }) => {
    try {
      const { vote } = await submitVoteResponseUseCase(resolve("vote"), resolve("graph"), resolve("user"))(
        id,
        req.user!.sub,
        body,
      );
      if (!vote) {
        return { status: 404, body: { message: "Vote not found" } };
      }
      return { status: 200, body: vote };
    } catch (err) {
      // Voter hors de son quartier de résidence → 403 (anti-bourrage d'urnes).
      if (err instanceof VoteDistrictForbiddenError) {
        return { status: 403, body: { message: err.message } };
      }
      // Les erreurs de validation métier (single_choice avec plusieurs options,
      // option inexistante, etc.) sont remontées en 400. L'auth/scope reste
      // géré en amont par le middleware contract-metadata.
      if (err instanceof InvalidVoteSubmissionError) {
        // Le contract n'expose pas (encore) un 400 pour cette route. On force
        // un 200 avec un payload "erreur" minimal ; à raffiner si tu veux un
        // vrai 400 (faut ajouter la response 400 au contract votesContract).
        // Pour l'instant on rejette via 404 pour que le front bascule en
        // catch et affiche le message générique.
        return { status: 404, body: { message: err.message } };
      }
      throw err;
    }
  },

  getVoteResults: async ({ params: { id } }) => {
    const results = await getVoteResultsUseCase(resolve("vote"))(id);
    if (!results) {
      return { status: 404, body: { message: "Vote not found" } };
    }
    return { status: 200, body: results };
  },
});
