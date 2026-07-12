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

export const votesContract = c.router({
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
