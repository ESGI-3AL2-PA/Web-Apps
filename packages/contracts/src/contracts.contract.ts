import { initContract } from "@ts-rest/core";
import { z } from "zod";

import {
  ContractParamsDtoSchema,
  ContractQueryDtoSchema,
  ContractResponseDtoSchema,
  CreateContractDtoSchema,
  DisputeContractDtoSchema,
  NotFoundErrorSchema,
  ForbiddenErrorSchema,
  BadRequestErrorSchema,
  BadGatewayErrorSchema,
  PaginatedResponseDtoSchema,
} from "./DTO";
import { auth } from "./auth-meta";

const c = initContract();

export const contractsContract = c.router({
  getContracts: {
    method: "GET",
    path: "/contracts",
    query: ContractQueryDtoSchema,
    responses: {
      200: PaginatedResponseDtoSchema(ContractResponseDtoSchema),
    },
    summary: "Get a paginated list of contracts",
    metadata: auth({ audience: "api" }),
  },

  getContractById: {
    method: "GET",
    path: "/contracts/:id",
    pathParams: ContractParamsDtoSchema,
    responses: {
      200: ContractResponseDtoSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Get a single contract by ID (party or admin)",
    metadata: auth({
      audience: "api",
      scope: {
        resource: "contract",
        ownerFields: ["providerId", "beneficiaryId"],
        districtField: "districtId",
        bypassRoles: ["superAdmin"],
        notFoundOnDeny: true,
      },
    }),
  },

  createContract: {
    method: "POST",
    path: "/contracts",
    body: CreateContractDtoSchema,
    responses: {
      201: ContractResponseDtoSchema,
      400: BadRequestErrorSchema,
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
      502: BadGatewayErrorSchema,
    },
    summary: "Create a new contract (the authenticated caller is the provider)",
    metadata: auth({ audience: "api" }),
  },

  resendContract: {
    method: "POST",
    path: "/contracts/:id/resend",
    pathParams: ContractParamsDtoSchema,
    body: c.noBody(),
    responses: {
      200: z.object({ resent: z.boolean() }),
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Re-send the Documenso signing invitation emails (party only)",
    metadata: auth({
      audience: "api",
      scope: { resource: "contract", ownerFields: ["providerId", "beneficiaryId"], districtField: "districtId" },
    }),
  },

  disputeContract: {
    method: "POST",
    path: "/contracts/:id/dispute",
    pathParams: ContractParamsDtoSchema,
    body: DisputeContractDtoSchema,
    responses: {
      200: ContractResponseDtoSchema,
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Mark a contract as disputed (party only)",
    metadata: auth({
      audience: "api",
      scope: { resource: "contract", ownerFields: ["providerId", "beneficiaryId"], districtField: "districtId" },
    }),
  },

  resolveDispute: {
    method: "POST",
    path: "/contracts/:id/resolve-dispute",
    pathParams: ContractParamsDtoSchema,
    body: c.noBody(),
    responses: {
      200: ContractResponseDtoSchema,
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Clear the disputed flag on a contract (district admin only)",
    // No ownerFields: only a district admin (matching districtId) or superAdmin may
    // resolve — the parties can raise a dispute but not clear it themselves.
    metadata: auth({
      audience: "api",
      scope: { resource: "contract", districtField: "districtId", bypassRoles: ["superAdmin"] },
    }),
  },

  deleteContract: {
    method: "DELETE",
    path: "/contracts/:id",
    pathParams: ContractParamsDtoSchema,
    body: c.noBody(),
    responses: {
      204: z.undefined(),
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Delete a contract (party or admin only)",
    metadata: auth({
      audience: "api",
      scope: {
        resource: "contract",
        ownerFields: ["providerId", "beneficiaryId"],
        districtField: "districtId",
        bypassRoles: ["superAdmin"],
      },
    }),
  },
});
