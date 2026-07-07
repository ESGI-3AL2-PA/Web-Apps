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
      404: NotFoundErrorSchema,
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
