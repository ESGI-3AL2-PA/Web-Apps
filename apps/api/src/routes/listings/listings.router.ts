import { initServer } from "@ts-rest/express";
import { listingsContract } from "@repo/contracts";
import { resolve } from "../../repositories/container.js";
import type { IUserRepository } from "../../repositories/User/user.repository.js";
import { resolveListDistrictScope } from "../../middleware/district-scope.js";
import { getListingsUseCase } from "../../use-cases/listings/get-listings.use-case.js";
import { getListingByIdUseCase } from "../../use-cases/listings/get-listing-by-id.use-case.js";
import { getListingsByIdUseCase } from "../../use-cases/listings/get-listings-by-id.use-case.js";
import { createListingUseCase } from "../../use-cases/listings/create-listing.use-case.js";
import { updateListingUseCase } from "../../use-cases/listings/update-listing.use-case.js";
import { deleteListingUseCase } from "../../use-cases/listings/delete-listing.use-case.js";

const s = initServer();

export const listingsRouter = s.router(listingsContract, {
  getListings: async ({ query: { page, limit, search, type, status, districtId, authorId, tag }, req }) => {
    const scope = resolveListDistrictScope(req.user!, districtId);
    if ("empty" in scope) {
      return { status: 200, body: { data: [], total: 0, page, limit } };
    }
    // Inject le contract repo pour que le use-case puisse peupler
    // `userHasContract` sur chaque listing renvoyé.
    const result = await getListingsUseCase(
      resolve("listing"),
      resolve("contract"),
    )({
      search,
      type,
      status,
      districtId: scope.districtId,
      authorId,
      tag,
      currentUserId: req.user?.sub,
      page,
      limit,
    });
    return { status: 200, body: result };
  },

  getListingById: async ({ params: { id } }) => {
    const listing = await getListingByIdUseCase(resolve("listing"))({ id });
    if (!listing) {
      return { status: 404, body: { message: "Listing not found" } };
    }
    return { status: 200, body: listing };
  },

  getListingsById: async ({ params: { id } }) => {
    const listings = await getListingsByIdUseCase(resolve("listing"))({ id });
    return { status: 200, body: listings };
  },

  createListing: async ({ body, req }) => {
    // Annotated so resolve("user") gets a contextual type — without it, TS infers
    // `never` here under ts-rest's generic handler context (works elsewhere because
    // the result flows into a typed use-case parameter).
    const userRepo: IUserRepository = resolve("user");
    const author = await userRepo.getUserById(req.user!.sub);
    if (!author) {
      return { status: 404, body: { message: "Author not found" } };
    }
    const newListing = await createListingUseCase(
      resolve("listing"),
      resolve("graph"),
    )({
      ...body,
      authorId: author.id,
      districtId: author.districtId,
    });
    return { status: 201, body: newListing };
  },

  updateListing: async ({ params: { id }, body }) => {
    // Ownership/admin authorization is enforced by the contract-metadata middleware.
    const listing = await updateListingUseCase(resolve("listing"))(id, body);
    if (!listing) {
      return { status: 404, body: { message: "Listing not found" } };
    }
    return { status: 200, body: listing };
  },

  deleteListing: async ({ params: { id } }) => {
    const deleted = await deleteListingUseCase(resolve("listing"), resolve("graph"))({ id });
    if (!deleted) {
      return { status: 404, body: { message: "Listing not found" } };
    }
    return { status: 204, body: undefined };
  },

  getActiveListingsCount: async () => {
    const listingRepo = resolve("listing") as any;
    const count = await listingRepo.countActiveListings();
    return { status: 200, body: { count } };
  },
});
