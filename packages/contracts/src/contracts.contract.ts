import { initContract } from "@ts-rest/core";
import { z } from "zod";

import {
  ContractParamsDtoSchema,
  ContractQueryDtoSchema,
  ContractResponseDtoSchema,
  CreateContractDtoSchema,
  DisputeContractDtoSchema,
  SignContractDtoSchema,
  NotFoundErrorSchema,
  PaginatedResponseDtoSchema,
} from "./DTO";

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
  },

  getContractById: {
    method: "GET",
    path: "/contracts/:id",
    pathParams: ContractParamsDtoSchema,
    responses: {
      200: ContractResponseDtoSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Get a single contract by ID",
  },

  createContract: {
    method: "POST",
    path: "/contracts",
    body: CreateContractDtoSchema,
    responses: {
      201: ContractResponseDtoSchema,
    },
    summary: "Create a new contract (typically when a paid listing is accepted)",
  },

  signContract: {
    method: "POST",
    path: "/contracts/:id/sign",
    pathParams: ContractParamsDtoSchema,
    body: SignContractDtoSchema,
    responses: {
      200: ContractResponseDtoSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Update contract signature status (OpenSign callback)",
  },

  disputeContract: {
    method: "POST",
    path: "/contracts/:id/dispute",
    pathParams: ContractParamsDtoSchema,
    body: DisputeContractDtoSchema,
    responses: {
      200: ContractResponseDtoSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Mark a contract as disputed",
  },

  deleteContract: {
    method: "DELETE",
    path: "/contracts/:id",
    pathParams: ContractParamsDtoSchema,
    body: c.noBody(),
    responses: {
      204: z.undefined(),
      404: NotFoundErrorSchema,
    },
    summary: "Delete a contract",
  },
});
