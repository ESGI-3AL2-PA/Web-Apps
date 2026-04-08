import { initServer } from "@ts-rest/express";
import { listingsContract } from "@repo/contracts";
import { resolve } from "../../repositories/container.js";
import { getListingsUseCase } from "../../use-cases/listings/get-listings.use-case.js";
import { getListingByIdUseCase } from "../../use-cases/listings/get-listing-by-id.use-case.js";
import { createListingUseCase } from "../../use-cases/listings/create-listing.use-case.js";
import { updateListingUseCase } from "../../use-cases/listings/update-listing.use-case.js";
import { deleteListingUseCase } from "../../use-cases/listings/delete-listing.use-case.js";

const s = initServer();

export const listingsRouter = s.router(listingsContract, {
  getListings: async ({ query: { page, limit, search, type, status, districtId, authorId } }) => {
    const result = await getListingsUseCase(resolve("listing"))({ search, type, status, districtId, authorId, page, limit });
    return { status: 200, body: result };
  },

  getListingById: async ({ params: { id } }) => {
    const listing = await getListingByIdUseCase(resolve("listing"))({ id });
    if (!listing) {
      return { status: 404, body: { message: "Listing not found" } };
    }
    return { status: 200, body: listing };
  },

  createListing: async ({ body }) => {
    // TODO: get authorId and districtId from authenticated user
    const newListing = await createListingUseCase(resolve("listing"))({
      ...body,
      authorId: "",
      districtId: "",
    });
    return { status: 201, body: newListing };
  },

  updateListing: async ({ params: { id }, body }) => {
    const listing = await updateListingUseCase(resolve("listing"))(id, body);
    if (!listing) {
      return { status: 404, body: { message: "Listing not found" } };
    }
    return { status: 200, body: listing };
  },

  deleteListing: async ({ params: { id } }) => {
    const deleted = await deleteListingUseCase(resolve("listing"))({ id });
    if (!deleted) {
      return { status: 404, body: { message: "Listing not found" } };
    }
    return { status: 204, body: undefined };
  },
});
