import { initContract } from "@ts-rest/core";
import { z } from "zod";

import {
  CreateListingDtoSchema,
  ListingParamsDtoSchema,
  ListingQueryDtoSchema,
  ListingResponseDtoSchema,
  UpdateListingDtoSchema,
  NotFoundErrorSchema,
  ForbiddenErrorSchema,
  PaginatedResponseDtoSchema,
} from "./DTO";
import { auth } from "./auth-meta";

const c = initContract();

export const listingsContract = c.router({
  getListings: {
    method: "GET",
    path: "/listings",
    query: ListingQueryDtoSchema,
    responses: {
      200: PaginatedResponseDtoSchema(ListingResponseDtoSchema),
    },
    summary: "Get a paginated list of listings",
    metadata: auth({ audience: "api" }),
  },

  getListingById: {
    method: "GET",
    path: "/listings/:id",
    pathParams: ListingParamsDtoSchema,
    responses: {
      200: ListingResponseDtoSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Get a single listing by ID",
    metadata: auth({ audience: "api" }),
  },

  createListing: {
    method: "POST",
    path: "/listings",
    body: CreateListingDtoSchema,
    responses: {
      201: ListingResponseDtoSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Create a new listing",
    metadata: auth({ audience: "api" }),
  },

  updateListing: {
    method: "PATCH",
    path: "/listings/:id",
    pathParams: ListingParamsDtoSchema,
    body: UpdateListingDtoSchema,
    responses: {
      200: ListingResponseDtoSchema,
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Partially update a listing (owner or admin)",
    metadata: auth({
      audience: "api",
      scope: {
        resource: "listing",
        ownerField: "authorId",
        districtField: "districtId",
        bypassRoles: ["superAdmin"],
      },
    }),
  },

  deleteListing: {
    method: "DELETE",
    path: "/listings/:id",
    pathParams: ListingParamsDtoSchema,
    body: c.noBody(),
    responses: {
      204: z.undefined(),
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Delete a listing (owner or admin)",
    metadata: auth({
      audience: "api",
      scope: {
        resource: "listing",
        ownerField: "authorId",
        districtField: "districtId",
        bypassRoles: ["superAdmin"],
      },
    }),
  },

  getActiveListingsCount: {
    method: "GET",
    path: "/listings/count/active",
    responses: {
      200: z.object({ count: z.number().int() }),
    },
    summary: "Get the number of active listings",
  },
});
