import { initContract } from "@ts-rest/core";
import { z } from "zod";

import {
  ContractParamsDtoSchema,
  ContractQueryDtoSchema,
  ContractResponseDtoSchema,
  CreateContractDtoSchema,
  DisputeContractDtoSchema,
  ResolveDisputeDtoSchema,
  NotFoundErrorSchema,
  ForbiddenErrorSchema,
  BadRequestErrorSchema,
  BadGatewayErrorSchema,
  ConflictErrorSchema,
  PaginatedResponseDtoSchema,
} from "./DTO";
import { auth } from "./auth-meta";

const c = initContract();

// Contrat ts-rest des contrats de service entre voisins (api). Un contrat lie un
// fournisseur (provider) et un bénéficiaire (payeur), avec séquestre de points et
// signature électronique Documenso. Toutes les routes exigent audience "api" ; le
// `scope` déclare l'enforcement propriété (provider/beneficiary) et/ou quartier.
export const contractsContract = c.router({
  // GET /contracts — authentifié. Liste paginée des contrats.
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

  // GET /contracts/:id — partie (provider/beneficiary), admin du quartier ou
  // superAdmin. 404 (au lieu de 403) si l'accès est refusé, pour masquer l'existence.
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

  // POST /contracts — authentifié. Crée un contrat ; l'appelant en est le bénéficiaire
  // (payeur). 502 si Documenso est indisponible.
  createContract: {
    method: "POST",
    path: "/contracts",
    body: CreateContractDtoSchema,
    responses: {
      201: ContractResponseDtoSchema,
      400: BadRequestErrorSchema,
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
      409: ConflictErrorSchema,
      502: BadGatewayErrorSchema,
    },
    summary: "Create a new contract (the authenticated caller is the beneficiary/payer)",
    metadata: auth({ audience: "api" }),
  },

  // POST /contracts/:id/resend — partie uniquement. Renvoie les emails d'invitation à
  // signer Documenso.
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

  // POST /contracts/:id/dispute — partie ou admin de quartier. Marque le contrat comme
  // litigieux (états pending/completed seulement).
  disputeContract: {
    method: "POST",
    path: "/contracts/:id/dispute",
    pathParams: ContractParamsDtoSchema,
    body: DisputeContractDtoSchema,
    responses: {
      200: ContractResponseDtoSchema,
      400: BadRequestErrorSchema,
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Mark a contract as disputed (party or district-admin; pending/completed only)",
    metadata: auth({
      audience: "api",
      scope: { resource: "contract", ownerFields: ["providerId", "beneficiaryId"], districtField: "districtId" },
    }),
  },

  // POST /contracts/:id/resolve-dispute — admin de quartier ou superAdmin. Tranche le
  // litige en versant le séquestre au fournisseur (release) ou au bénéficiaire (refund).
  resolveDispute: {
    method: "POST",
    path: "/contracts/:id/resolve-dispute",
    pathParams: ContractParamsDtoSchema,
    body: ResolveDisputeDtoSchema,
    responses: {
      200: ContractResponseDtoSchema,
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
      // Le litige vise un contrat dont le séquestre est déjà versé au fournisseur — un
      // remboursement exigerait un clawback que ce chemin n'effectue pas.
      409: ConflictErrorSchema,
    },
    summary:
      "Resolve a dispute, settling the escrow to the provider (release) or beneficiary (refund) (district admin only)",
    // Pas d'ownerFields : seul un admin du quartier (districtId correspondant) ou un
    // superAdmin peut trancher — les parties peuvent ouvrir un litige mais pas le clore.
    metadata: auth({
      audience: "api",
      scope: { resource: "contract", districtField: "districtId", bypassRoles: ["superAdmin"] },
    }),
  },

  // DELETE /contracts/:id — partie, admin de quartier ou superAdmin.
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
