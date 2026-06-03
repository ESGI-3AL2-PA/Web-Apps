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
  NotFoundErrorSchema,
  ForbiddenErrorSchema,
  PaginatedResponseDtoSchema,
} from "./DTO";

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
  },

  createVote: {
    method: "POST",
    path: "/votes",
    body: CreateVoteDtoSchema,
    responses: {
      201: VoteResponseDtoSchema,
    },
    summary: "Create a new vote",
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
  },

  submitVoteResponse: {
    method: "POST",
    path: "/votes/:id/responses",
    pathParams: VoteParamsDtoSchema,
    body: SubmitVoteResponseDtoSchema,
    responses: {
      200: VoteResponseDtoSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Cast a vote response",
  },

  getVoteResults: {
    method: "GET",
    path: "/votes/:id/results",
    pathParams: VoteParamsDtoSchema,
    responses: {
      200: VoteResultsResponseDtoSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Get aggregated results for a vote",
  },
});
