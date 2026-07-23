import { initContract } from "@ts-rest/core";
import { z } from "zod";

import {
  CreateVoteDtoSchema,
  SubmitVoteResponseDtoSchema,
  UpdateVoteDtoSchema,
  VoteParamsDtoSchema,
  VoteQueryDtoSchema,
  VoteResponseDtoSchema,
  VoteResultsResponseDtoSchema,
  BadRequestErrorSchema,
  NotFoundErrorSchema,
  ForbiddenErrorSchema,
  PaginatedResponseDtoSchema,
} from "./DTO";
import { auth } from "./auth-meta";

const c = initContract();

/**
 * Contract ts-rest des votes / sondages.
 *
 * Un vote peut cibler plusieurs quartiers (districtIds). Lectures ouvertes à
 * tout utilisateur authentifié. La création est ouverte (les résidents ne
 * peuvent viser que leur propre quartier) ; la mise à jour et la suppression
 * sont réservées au créateur ou à un admin de l'un des quartiers ciblés
 * (districtArrayField, bypass superAdmin). Des routes complémentaires
 * enregistrent une réponse et agrègent les résultats.
 */
export const votesContract = c.router({
  // GET /votes — liste paginée des votes. Tout utilisateur authentifié.
  getVotes: {
    method: "GET",
    path: "/votes",
    query: VoteQueryDtoSchema,
    responses: {
      200: PaginatedResponseDtoSchema(VoteResponseDtoSchema),
    },
    summary: "Get a paginated list of votes",
    metadata: auth({ audience: "api" }),
  },

  // GET /votes/:id — un vote par son id. Tout utilisateur authentifié.
  getVoteById: {
    method: "GET",
    path: "/votes/:id",
    pathParams: VoteParamsDtoSchema,
    responses: {
      200: VoteResponseDtoSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Get a single vote by ID",
    metadata: auth({ audience: "api" }),
  },

  // POST /votes — crée un vote (brouillon ; les résidents ne peuvent viser que leur propre quartier).
  createVote: {
    method: "POST",
    path: "/votes",
    body: CreateVoteDtoSchema,
    responses: {
      201: VoteResponseDtoSchema,
      403: ForbiddenErrorSchema,
    },
    summary: "Create a new vote (draft; residents may only target their own district)",
    metadata: auth({ audience: "api" }),
  },

  // PATCH /votes/:id — mise à jour partielle. Créateur (ownerField) ou admin d'un des quartiers ciblés.
  updateVote: {
    method: "PATCH",
    path: "/votes/:id",
    pathParams: VoteParamsDtoSchema,
    body: UpdateVoteDtoSchema,
    responses: {
      200: VoteResponseDtoSchema,
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Partially update a vote (creator or admin only)",
    metadata: auth({
      audience: "api",
      scope: {
        resource: "vote",
        ownerField: "creatorId",
        districtArrayField: "districtIds",
        bypassRoles: ["superAdmin"],
      },
    }),
  },

  // DELETE /votes/:id — supprime un vote. Créateur ou admin d'un des quartiers ciblés.
  deleteVote: {
    method: "DELETE",
    path: "/votes/:id",
    pathParams: VoteParamsDtoSchema,
    body: c.noBody(),
    responses: {
      204: z.undefined(),
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Delete a vote (creator or admin only)",
    metadata: auth({
      audience: "api",
      scope: {
        resource: "vote",
        ownerField: "creatorId",
        districtArrayField: "districtIds",
        bypassRoles: ["superAdmin"],
      },
    }),
  },

  // POST /votes/:id/responses — enregistre la réponse de l'utilisateur au vote. Tout utilisateur authentifié.
  submitVoteResponse: {
    method: "POST",
    path: "/votes/:id/responses",
    pathParams: VoteParamsDtoSchema,
    body: SubmitVoteResponseDtoSchema,
    responses: {
      200: VoteResponseDtoSchema,
      400: BadRequestErrorSchema,
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Cast a vote response",
    metadata: auth({ audience: "api" }),
  },

  // GET /votes/:id/results — résultats agrégés d'un vote. Tout utilisateur authentifié.
  getVoteResults: {
    method: "GET",
    path: "/votes/:id/results",
    pathParams: VoteParamsDtoSchema,
    responses: {
      200: VoteResultsResponseDtoSchema,
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Get aggregated results for a vote",
    metadata: auth({ audience: "api" }),
  },
});
