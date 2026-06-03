import { initServer } from "@ts-rest/express";
import { contractsContract } from "@repo/contracts";
import { resolve } from "../../repositories/container.js";
import { getContractsUseCase } from "../../use-cases/contracts/get-contracts.use-case.js";
import { getContractByIdUseCase } from "../../use-cases/contracts/get-contract-by-id.use-case.js";
import { createContractUseCase } from "../../use-cases/contracts/create-contract.use-case.js";
import { signContractUseCase } from "../../use-cases/contracts/sign-contract.use-case.js";
import { disputeContractUseCase } from "../../use-cases/contracts/dispute-contract.use-case.js";
import { deleteContractUseCase } from "../../use-cases/contracts/delete-contract.use-case.js";
import type { AuthUser } from "../../middleware/auth.middleware.js";

const isParty = (contract: { providerId: string; beneficiaryId: string }, user: AuthUser): boolean =>
  contract.providerId === user.sub || contract.beneficiaryId === user.sub;

const s = initServer();

export const contractsRouter = s.router(contractsContract, {
  getContracts: async ({
    query: { page, limit, listingId, providerId, beneficiaryId, openSignStatus, disputed },
    req,
  }) => {
    const isAdmin = req.user!.role === "admin";
    const result = await getContractsUseCase(resolve("contract"))({
      listingId,
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

  getContractById: async ({ params: { id }, req }) => {
    const contract = await getContractByIdUseCase(resolve("contract"))({ id });
    // Only the two parties (or an admin) may view a contract.
    if (!contract || (!isParty(contract, req.user!) && req.user!.role !== "admin")) {
      return { status: 404, body: { message: "Contract not found" } };
    }
    return { status: 200, body: contract };
  },

  createContract: async ({ body, req }) => {
    // The request author is the provider; the beneficiary comes from the body.
    const newContract = await createContractUseCase(resolve("contract"))({
      ...body,
      providerId: req.user!.sub,
    });
    return { status: 201, body: newContract };
  },

  signContract: async ({ params: { id }, body, req }) => {
    const existing = await getContractByIdUseCase(resolve("contract"))({ id });
    if (!existing) {
      return { status: 404, body: { message: "Contract not found" } };
    }
    if (!isParty(existing, req.user!)) {
      return { status: 403, body: { message: "Only a party to the contract may sign it" } };
    }
    const contract = await signContractUseCase(resolve("contract"))(id, body);
    if (!contract) {
      return { status: 404, body: { message: "Contract not found" } };
    }
    return { status: 200, body: contract };
  },

  disputeContract: async ({ params: { id }, body, req }) => {
    const existing = await getContractByIdUseCase(resolve("contract"))({ id });
    if (!existing) {
      return { status: 404, body: { message: "Contract not found" } };
    }
    if (!isParty(existing, req.user!)) {
      return { status: 403, body: { message: "Only a party to the contract may dispute it" } };
    }
    const contract = await disputeContractUseCase(resolve("contract"))(id, body);
    if (!contract) {
      return { status: 404, body: { message: "Contract not found" } };
    }
    return { status: 200, body: contract };
  },

  deleteContract: async ({ params: { id }, req }) => {
    const existing = await getContractByIdUseCase(resolve("contract"))({ id });
    if (!existing) {
      return { status: 404, body: { message: "Contract not found" } };
    }
    if (!isParty(existing, req.user!) && req.user!.role !== "admin") {
      return { status: 403, body: { message: "Party or admin only" } };
    }
    const deleted = await deleteContractUseCase(resolve("contract"))({ id });
    if (!deleted) {
      return { status: 404, body: { message: "Contract not found" } };
    }
    return { status: 204, body: undefined };
  },
});
