import { initServer } from "@ts-rest/express";
import { contractsContract } from "@repo/contracts";
import { resolve } from "../../repositories/container.js";
import { getContractsUseCase } from "../../use-cases/contracts/get-contracts.use-case.js";
import { getContractByIdUseCase } from "../../use-cases/contracts/get-contract-by-id.use-case.js";
import {
  createContractUseCase,
  InvalidContractCreationError,
} from "../../use-cases/contracts/create-contract.use-case.js";
import {
  signContractUseCase,
  InvalidSignatureError,
} from "../../use-cases/contracts/sign-contract.use-case.js";
import { disputeContractUseCase } from "../../use-cases/contracts/dispute-contract.use-case.js";
import { deleteContractUseCase } from "../../use-cases/contracts/delete-contract.use-case.js";

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

  getContractById: async ({ params: { id } }) => {
    // Party/admin authorization (404-on-deny) is enforced by the contract-metadata middleware.
    const contract = await getContractByIdUseCase(resolve("contract"))({ id });
    if (!contract) {
      return { status: 404, body: { message: "Contract not found" } };
    }
    return { status: 200, body: contract };
  },

  createContract: async ({ body, req }) => {
    // Le caller est LE BÉNÉFICIAIRE (= celui qui "prend" le service annoncé).
    // Le provider est dérivé du listing par le use-case.
    try {
      const newContract = await createContractUseCase(
        resolve("contract"),
        resolve("user"),
        resolve("listing"),
      )({
        ...body,
        beneficiaryId: req.user!.sub,
      });
      return { status: 201, body: newContract };
    } catch (err) {
      if (err instanceof InvalidContractCreationError) {
        // Le contract n'expose pas de 400 explicite — on renvoie 404 pour que
        // le front bascule en catch et affiche le message.
        return { status: 404, body: { message: err.message } };
      }
      throw err;
    }
  },

  signContract: async ({ params: { id }, body, req }) => {
    // Party-only authorization is enforced by the contract-metadata middleware,
    // mais le use-case re-vérifie aussi l'identité signataire.
    try {
      const contract = await signContractUseCase(resolve("contract"))(id, req.user!.sub, body);
      if (!contract) {
        return { status: 404, body: { message: "Contract not found" } };
      }
      return { status: 200, body: contract };
    } catch (err) {
      if (err instanceof InvalidSignatureError) {
        return { status: 404, body: { message: err.message } };
      }
      throw err;
    }
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
