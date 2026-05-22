import { initServer } from "@ts-rest/express";
import { contractsContract } from "@repo/contracts";
import { resolve } from "../../repositories/container.js";
import { getContractsUseCase } from "../../use-cases/contracts/get-contracts.use-case.js";
import { getContractByIdUseCase } from "../../use-cases/contracts/get-contract-by-id.use-case.js";
import { createContractUseCase } from "../../use-cases/contracts/create-contract.use-case.js";
import { signContractUseCase } from "../../use-cases/contracts/sign-contract.use-case.js";
import { disputeContractUseCase } from "../../use-cases/contracts/dispute-contract.use-case.js";
import { deleteContractUseCase } from "../../use-cases/contracts/delete-contract.use-case.js";

const s = initServer();

export const contractsRouter = s.router(contractsContract, {
  getContracts: async ({ query: { page, limit, listingId, providerId, beneficiaryId, openSignStatus, disputed } }) => {
    const result = await getContractsUseCase(resolve("contract"))({
      listingId,
      providerId,
      beneficiaryId,
      openSignStatus,
      disputed,
      page,
      limit,
    });
    return { status: 200, body: result };
  },

  getContractById: async ({ params: { id } }) => {
    const contract = await getContractByIdUseCase(resolve("contract"))({ id });
    if (!contract) {
      return { status: 404, body: { message: "Contract not found" } };
    }
    return { status: 200, body: contract };
  },

  createContract: async ({ body }) => {
    const newContract = await createContractUseCase(resolve("contract"))(body);
    return { status: 201, body: newContract };
  },

  signContract: async ({ params: { id }, body }) => {
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
