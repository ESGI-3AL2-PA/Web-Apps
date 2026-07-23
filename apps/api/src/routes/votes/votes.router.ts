import { initServer } from "@ts-rest/express";
import { votesContract } from "@repo/contracts";
import { resolve } from "../../repositories/container.js";
import type { IUserRepository } from "../../repositories/User/user.repository.js";
import { callerCanReadDistrict, resolveCallerListDistrict } from "../../middleware/district-scope.js";
import { getVotesUseCase } from "../../use-cases/votes/get-votes.use-case.js";
import { getVoteByIdUseCase } from "../../use-cases/votes/get-vote-by-id.use-case.js";
import { createVoteUseCase } from "../../use-cases/votes/create-vote.use-case.js";
import { updateVoteUseCase, VoteDateRangeError } from "../../use-cases/votes/update-vote.use-case.js";
import { deleteVoteUseCase } from "../../use-cases/votes/delete-vote.use-case.js";
import {
  submitVoteResponseUseCase,
  InvalidVoteSubmissionError,
  VoteDistrictForbiddenError,
} from "../../use-cases/votes/submit-vote-response.use-case.js";
import { getVoteResultsUseCase } from "../../use-cases/votes/get-vote-results.use-case.js";

const s = initServer();

// Le quartier de résidence d'un user n'est pas dans le JWT (seul adminDistrictId
// y figure) — on le charge. Retourne null si le compte n'existe plus.
const callerDistrictId = async (userId: string): Promise<string | null> => {
  const userRepo: IUserRepository = resolve("user");
  const caller = await userRepo.getUserById(userId);
  return caller?.districtId ?? null;
};

/**
 * Router ts-rest des votes / sondages de quartier.
 *
 * Couche router. Règles de visibilité et de création selon le rôle :
 *  - résident : propose en `draft` uniquement pour son quartier, ne voit les
 *    résultats qu'après avoir voté (ou une fois le scrutin clos) ;
 *  - admin : confiné à son adminDistrictId, peut publier/fermer ;
 *  - superAdmin : n'importe quel quartier.
 * Les refus de lecture renvoient 404 (et non 403) pour ne pas divulguer l'existence
 * d'un vote d'un quartier voisin.
 */
export const votesRouter = s.router(votesContract, {
  getVotes: async ({ query, req }) => {
    const user = req.user!;
    const empty = { status: 200 as const, body: { data: [], total: 0, page: query.page, limit: query.limit } };
    const scope = await resolveCallerListDistrict(user, query.districtId, resolve("user"));
    if ("empty" in scope) return empty;
    // On passe l'ID du user authentifié pour que la repo peuple
    // `userHasVoted` / `myChosenOptions` sur chaque vote renvoyé.
    const result = await getVotesUseCase(resolve("vote"))({
      ...query,
      districtId: scope.districtId,
      currentUserId: user.sub,
    });
    return { status: 200, body: result };
  },

  getVoteById: async ({ params: { id }, req }) => {
    const user = req.user!;
    const vote = await getVoteByIdUseCase(resolve("vote"))({ id, currentUserId: user.sub });
    if (!vote) {
      return { status: 404, body: { message: "Vote not found" } };
    }
    // 404 (et non 403) pour ne pas divulguer l'existence d'un vote voisin.
    if (!(await callerCanReadDistrict(user, vote.districtIds, resolve("user")))) {
      return { status: 404, body: { message: "Vote not found" } };
    }
    return { status: 200, body: vote };
  },

  createVote: async ({ body, req }) => {
    const user = req.user!;
    const districtIds = body.districtIds ?? [];
    // Résidents : proposent (createVote force status:"draft") uniquement pour LEUR quartier.
    // Admins : confinés à leur adminDistrictId. superAdmin : n'importe quel quartier.
    if (user.role === "superAdmin") {
      // aucune restriction de quartier
    } else if (user.role === "admin") {
      if (!user.adminDistrictId || districtIds.length === 0 || !districtIds.every((d) => d === user.adminDistrictId)) {
        return { status: 403, body: { message: "Vous ne pouvez créer un vote que pour votre quartier" } };
      }
    } else {
      const resident = await callerDistrictId(user.sub);
      if (!resident || districtIds.length === 0 || !districtIds.every((d) => d === resident)) {
        return { status: 403, body: { message: "Vous ne pouvez proposer un vote que pour votre quartier" } };
      }
    }
    const newVote = await createVoteUseCase(
      resolve("vote"),
      resolve("graph"),
    )({
      ...body,
      creatorId: user.sub,
    });
    return { status: 201, body: newVote };
  },

  updateVote: async ({ params: { id }, body, req }) => {
    const user = req.user!;
    // Publier / fermer un vote (changer status) est réservé aux admins — un créateur
    // résident propose en draft mais ne peut pas l'ouvrir lui-même.
    const isAdmin = user.role === "admin" || user.role === "superAdmin";
    if (body.status !== undefined && !isAdmin) {
      return { status: 403, body: { message: "Seul un administrateur peut publier ou fermer un vote" } };
    }
    try {
      const vote = await updateVoteUseCase(resolve("vote"))(id, body);
      if (!vote) {
        return { status: 404, body: { message: "Vote not found" } };
      }
      return { status: 200, body: vote };
    } catch (err) {
      if (err instanceof VoteDateRangeError) {
        return { status: 400, body: { message: err.message } };
      }
      throw err;
    }
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
      // option inexistante, vote clos, deadline dépassée) sont remontées en 400.
      // L'auth/scope reste géré en amont par le middleware contract-metadata.
      if (err instanceof InvalidVoteSubmissionError) {
        return { status: 400, body: { message: err.message } };
      }
      throw err;
    }
  },

  getVoteResults: async ({ params: { id }, req }) => {
    const user = req.user!;
    // Même règle de visibilité que la carte : un résident ne voit le détail
    // qu'après avoir voté (ou une fois le scrutin clos). Les admins voient tout.
    // Gate ici aussi, sinon un GET direct court-circuite le masquage côté carte.
    const isAdmin = user.role === "admin" || user.role === "superAdmin";
    if (!isAdmin) {
      const vote = await getVoteByIdUseCase(resolve("vote"))({ id, currentUserId: user.sub });
      if (!vote) {
        return { status: 404, body: { message: "Vote not found" } };
      }
      const isClosed = vote.status !== "open" || new Date(vote.endDate).getTime() < Date.now();
      if (!vote.userHasVoted && !isClosed) {
        return { status: 403, body: { message: "Les résultats seront visibles après votre vote" } };
      }
    }
    const results = await getVoteResultsUseCase(resolve("vote"))(id);
    if (!results) {
      return { status: 404, body: { message: "Vote not found" } };
    }
    return { status: 200, body: results };
  },
});
