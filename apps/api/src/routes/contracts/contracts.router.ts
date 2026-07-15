import { initServer } from "@ts-rest/express";
import { contractsContract } from "@repo/contracts";
import type { ContractResponseDto } from "@repo/contracts";
import { resolve } from "../../repositories/container.js";
import type { IListingRepository } from "../../repositories/Listing/listing.repository.js";
import type { IUserRepository } from "../../repositories/User/user.repository.js";
import type { Contract } from "../../entities/contract.entity.js";
import { resolveListDistrictScope } from "../../middleware/district-scope.js";
import { documensoService, DocumensoServiceError } from "../../services/documenso.service.js";
import { getContractsUseCase } from "../../use-cases/contracts/get-contracts.use-case.js";
import { getContractByIdUseCase } from "../../use-cases/contracts/get-contract-by-id.use-case.js";
import {
  createContractUseCase,
  ContractPartyNotFoundError,
  InsufficientFundsError,
  DuplicateContractError,
} from "../../use-cases/contracts/create-contract.use-case.js";
import { resendContractUseCase } from "../../use-cases/contracts/resend-contract.use-case.js";
import {
  disputeContractUseCase,
  InvalidDisputeStateError,
} from "../../use-cases/contracts/dispute-contract.use-case.js";
import { resolveDisputeUseCase, UnsettleableDisputeError } from "../../use-cases/contracts/resolve-dispute.use-case.js";
import { deleteContractUseCase } from "../../use-cases/contracts/delete-contract.use-case.js";

const s = initServer();

// Maps a contract entity to its response, exposing only the *caller's* signing URL.
// A recipient's Documenso signing URL carries a token that authorizes signing as
// that party, so the other party's URL must never be returned.
const toResponse = (contract: Contract, userId: string | undefined): ContractResponseDto => ({
  id: contract.id,
  listingId: contract.listingId,
  districtId: contract.districtId,
  providerId: contract.providerId,
  beneficiaryId: contract.beneficiaryId,
  price: contract.price,
  signatureStatus: contract.signatureStatus,
  disputed: contract.disputed,
  disputeReason: contract.disputeReason ?? null,
  createdAt: contract.createdAt,
  signingUrl:
    contract.signatureStatus === "completed"
      ? null
      : userId === contract.providerId
        ? contract.providerSigningUrl
        : userId === contract.beneficiaryId
          ? contract.beneficiarySigningUrl
          : null,
});

export const contractsRouter = s.router(contractsContract, {
  getContracts: async ({
    query: { page, limit, listingId, districtId, providerId, beneficiaryId, signatureStatus, disputed },
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
      signatureStatus,
      disputed,
      page,
      limit,
    });
    return {
      status: 200,
      body: { ...result, data: result.data.map((c) => toResponse(c, req.user!.sub)) },
    };
  },

  getContractById: async ({ params: { id }, req }) => {
    // Party/admin authorization (404-on-deny) is enforced by the contract-metadata middleware.
    const contract = await getContractByIdUseCase(resolve("contract"))({ id });
    if (!contract) {
      return { status: 404, body: { message: "Contract not found" } };
    }
    return { status: 200, body: toResponse(contract, req.user!.sub) };
  },

  createContract: async ({ body, req }) => {
    // Annotated so resolve(...) gets a contextual type — see listings.router for the same workaround.
    const listingRepo: IListingRepository = resolve("listing");
    const userRepo: IUserRepository = resolve("user");
    const listing = await listingRepo.getListingById(body.listingId);
    if (!listing) {
      return { status: 404, body: { message: "Listing not found" } };
    }
    // Only an open listing can be contracted.
    if (listing.status !== "active") {
      return { status: 400, body: { message: "This listing is no longer active" } };
    }
    // The caller is the beneficiary (payer, whose tokens are escrowed); the provider
    // being booked comes from the body.
    const beneficiaryId = req.user!.sub;
    // A contract binds two distinct people.
    if (beneficiaryId === body.providerId) {
      return { status: 400, body: { message: "Provider and beneficiary must be different users" } };
    }
    // Listings are offers: the author is the provider being booked, the caller is the
    // beneficiary. Guard against a mismatched providerId in the body.
    if (listing.authorId !== body.providerId) {
      return { status: 403, body: { message: "You are not a party to this listing's contract" } };
    }
    // districtId and price are derived server-side from the referenced listing, never
    // from the client — the escrowed amount always matches the advertised price.
    try {
      const newContract = await createContractUseCase(
        resolve("contract"),
        userRepo,
        documensoService,
        resolve("transaction"),
      )({
        ...body,
        beneficiaryId,
        districtId: listing.districtId,
        price: listing.price,
        redirectUrl: process.env.CONTRACTS_SIGN_REDIRECT_URL,
      });
      return { status: 201, body: toResponse(newContract, req.user!.sub) };
    } catch (err) {
      if (err instanceof ContractPartyNotFoundError) {
        return { status: 404, body: { message: err.message } };
      }
      // An identical active contract already exists (double-submit).
      if (err instanceof DuplicateContractError) {
        return { status: 409, body: { message: err.message } };
      }
      // Beneficiary can't cover the price to escrow.
      if (err instanceof InsufficientFundsError) {
        return { status: 400, body: { message: err.message } };
      }
      // The e-signature service failed — surface as a gateway error, not a 500.
      if (err instanceof DocumensoServiceError) {
        return { status: 502, body: { message: "The signature service is unavailable, please retry" } };
      }
      throw err;
    }
  },

  resendContract: async ({ params: { id } }) => {
    // Party-only authorization is enforced by the contract-metadata middleware.
    const resent = await resendContractUseCase(resolve("contract"), documensoService)({ id });
    if (!resent) {
      return { status: 404, body: { message: "Contract not found" } };
    }
    return { status: 200, body: { resent: true } };
  },

  disputeContract: async ({ params: { id }, body, req }) => {
    try {
      const contract = await disputeContractUseCase(resolve("contract"))(id, body);
      if (!contract) {
        return { status: 404, body: { message: "Contract not found" } };
      }
      return { status: 200, body: toResponse(contract, req.user!.sub) };
    } catch (err) {
      if (err instanceof InvalidDisputeStateError) {
        return { status: 400, body: { message: err.message } };
      }
      throw err;
    }
  },

  resolveDispute: async ({ params: { id }, body, req }) => {
    // District-admin-only authorization is enforced by the contract-metadata middleware.
    try {
      const contract = await resolveDisputeUseCase(
        resolve("contract"),
        resolve("transaction"),
      )({
        id,
        resolution: body.resolution,
      });
      if (!contract) {
        return { status: 404, body: { message: "Contract not found" } };
      }
      return { status: 200, body: toResponse(contract, req.user!.sub) };
    } catch (err) {
      // A refund was requested on a contract whose escrow is already settled to the provider.
      if (err instanceof UnsettleableDisputeError) {
        return { status: 409, body: { message: err.message } };
      }
      throw err;
    }
  },

  deleteContract: async ({ params: { id } }) => {
    const deleted = await deleteContractUseCase(resolve("contract"), resolve("transaction"))({ id });
    if (!deleted) {
      return { status: 404, body: { message: "Contract not found" } };
    }
    return { status: 204, body: undefined };
  },
});
