import { initServer } from "@ts-rest/express";
import { contractsContract } from "@repo/contracts";
import { resolve } from "../../repositories/container.js";
import type { IListingRepository } from "../../repositories/Listing/listing.repository.js";
import { resolveListDistrictScope } from "../../middleware/district-scope.js";
import { getContractsUseCase } from "../../use-cases/contracts/get-contracts.use-case.js";
import { getContractByIdUseCase } from "../../use-cases/contracts/get-contract-by-id.use-case.js";
import { createContractUseCase } from "../../use-cases/contracts/create-contract.use-case.js";
import { signContractUseCase } from "../../use-cases/contracts/sign-contract.use-case.js";
import { disputeContractUseCase } from "../../use-cases/contracts/dispute-contract.use-case.js";
import { deleteContractUseCase } from "../../use-cases/contracts/delete-contract.use-case.js";

const s = initServer();

export const contractsRouter = s.router(contractsContract, {
  getContracts: async ({
    query: { page, limit, listingId, districtId, providerId, beneficiaryId, openSignStatus, disputed },
    req,
  }) => {
    const scope = resolveListDistrictScope(req.user!, districtId);
    if ("empty" in scope) {
      return { status: 200, body: { data: [], total: 0, page, limit } };
    }
    const isAdmin = req.user!.role === "admin";
    const result = await getContractsUseCase(resolve("contract"))({
      listingId,
      districtId: scope.districtId,
      // Non-admins only see contracts they are a party to; admins may filter by either side.
      providerId: isAdmin ? providerId : undefined,
      beneficiaryId: isAdmin ? beneficiaryId : undefined,
      partyId: isAdmin ? undefined : req.user!.sub,
      openSignStatus,
      disputed,
      page,
      limit,
    });
    return { status: 200, body: result };
  },

  getContractById: async ({ params: { id } }) => {
    // Party/admin authorization (404-on-deny) is enforced by the contract-metadata middleware.
    const contract = await getContractByIdUseCase(resolve("contract"))({ id });
    if (!contract) {
      return { status: 404, body: { message: "Contract not found" } };
    }
    return { status: 200, body: contract };
  },

  createContract: async ({ body, req }) => {
    // Annotated so resolve("listing") gets a contextual type — see listings.router for the same workaround.
    const listingRepo: IListingRepository = resolve("listing");
    const listing = await listingRepo.getListingById(body.listingId);
    if (!listing) {
      return { status: 404, body: { message: "Listing not found" } };
    }
    // The request author is the provider; the beneficiary comes from the body.
    // districtId is derived server-side from the referenced listing, never from the client.
    const newContract = await createContractUseCase(resolve("contract"))({
      ...body,
      providerId: req.user!.sub,
      districtId: listing.districtId,
    });
    return { status: 201, body: newContract };
  },

  signContract: async ({ params: { id }, body }) => {
    // Party-only authorization is enforced by the contract-metadata middleware.
    const contract = await signContractUseCase(resolve("contract"))(id, body);
    if (!contract) {
      return { status: 404, body: { message: "Contract not found" } };
    }
    return { status: 200, body: contract };
  },

  disputeContract: async ({ params: { id }, body }) => {
    const contract = await disputeContractUseCase(resolve("contract"))(id, body);
    if (!contract) {
      return { status: 404, body: { message: "Contract not found" } };
    }
    return { status: 200, body: contract };
  },

  deleteContract: async ({ params: { id } }) => {
    const deleted = await deleteContractUseCase(resolve("contract"))({ id });
    if (!deleted) {
      return { status: 404, body: { message: "Contract not found" } };
    }
    return { status: 204, body: undefined };
  },
});
