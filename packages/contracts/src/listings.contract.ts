import { initContract } from "@ts-rest/core";
import { z } from "zod";

import {
  CreateListingDtoSchema,
  ListingParamsDtoSchema,
  ListingQueryDtoSchema,
  ListingResponseDtoSchema,
  UpdateListingDtoSchema,
  NotFoundErrorSchema,
  PaginatedResponseDtoSchema,
} from "./DTO";

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
  },

  createListing: {
    method: "POST",
    path: "/listings",
    body: CreateListingDtoSchema,
    responses: {
      201: ListingResponseDtoSchema,
    },
    summary: "Create a new listing",
  },

  updateListing: {
    method: "PATCH",
    path: "/listings/:id",
    pathParams: ListingParamsDtoSchema,
    body: UpdateListingDtoSchema,
    responses: {
      200: ListingResponseDtoSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Partially update a listing",
  },

  deleteListing: {
    method: "DELETE",
    path: "/listings/:id",
    pathParams: ListingParamsDtoSchema,
    body: c.noBody(),
    responses: {
      204: z.undefined(),
      404: NotFoundErrorSchema,
    },
    summary: "Delete a listing",
  },
});
