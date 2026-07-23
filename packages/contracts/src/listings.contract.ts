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

/**
 * Contract ts-rest des annonces (listings).
 *
 * Lectures ouvertes à tout utilisateur authentifié. La création est ouverte ;
 * la mise à jour et la suppression sont réservées à l'auteur ou à un
 * administrateur du quartier de l'annonce (bypass superAdmin). Une route de
 * comptage renvoie le nombre d'annonces actives, éventuellement par quartier.
 */
export const listingsContract = c.router({
  // GET /listings — liste paginée des annonces. Tout utilisateur authentifié.
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

  // GET /listings/:id — une annonce par son id. Tout utilisateur authentifié.
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

  // POST /listings — crée une annonce. Tout utilisateur authentifié.
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

  // PATCH /listings/:id — mise à jour partielle. Auteur (ownerField) ou admin du quartier.
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

  // DELETE /listings/:id — supprime une annonce. Auteur ou admin du quartier.
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

  // GET /listings/count/active — nombre d'annonces actives, éventuellement limité à un quartier.
  getActiveListingsCount: {
    method: "GET",
    path: "/listings/count/active",
    query: z.object({
      // Restreint le comptage à un seul quartier.
      districtId: z.string().optional().openapi({ description: "Restrict the count to one district" }),
    }),
    responses: {
      200: z.object({ count: z.number().int() }),
    },
    summary: "Get the number of active listings",
    metadata: auth({ audience: "api" }),
  },
});
