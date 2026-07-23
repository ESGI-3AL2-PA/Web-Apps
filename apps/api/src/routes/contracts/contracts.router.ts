import { initServer } from "@ts-rest/express";
import { contractsContract } from "@repo/contracts";
import type { ContractResponseDto } from "@repo/contracts";
import { resolve } from "../../repositories/container.js";
import type { Contract } from "../../entities/contract.entity.js";
import { resolveListDistrictScope } from "../../middleware/district-scope.js";
import { documensoService, DocumensoServiceError } from "../../services/documenso.service.js";
import { logger } from "../../logger.js";
import { getContractsUseCase } from "../../use-cases/contracts/get-contracts.use-case.js";
import { getContractByIdUseCase } from "../../use-cases/contracts/get-contract-by-id.use-case.js";
import {
  createContractUseCase,
  ListingNotFoundError,
  ListingNotActiveError,
  SamePartyError,
  NotListingProviderError,
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

/**
 * Router ts-rest des contrats (mandats de service entre un prestataire et un
 * bénéficiaire, avec signature électronique Documenso et séquestre de points).
 * Chaque handler résout ses dépendances via `resolve()` et délègue au cas d'usage.
 */

// Mappe une entité contrat vers sa réponse, en n'exposant que l'URL de signature de
// *l'appelant*. L'URL de signature Documenso d'un destinataire porte un token qui
// autorise à signer en tant que cette partie ; l'URL de l'autre partie ne doit donc
// jamais être renvoyée.
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
  // GET /contracts — liste paginée, bornée au quartier de l'appelant.
  getContracts: async ({
    query: { page, limit, listingId, districtId, providerId, beneficiaryId, signatureStatus, disputed },
    req,
  }) => {
    const scope = resolveListDistrictScope(req.user!, districtId);
    if ("empty" in scope) {
      return { status: 200, body: { data: [], total: 0, page, limit } };
    }
    const isAdmin = req.user!.role === "admin" || req.user!.role === "superAdmin";
    const result = await getContractsUseCase(resolve("contract"))({
      listingId,
      districtId: scope.districtId,
      // Les non-admins ne voient que les contrats dont ils sont partie ; les admins
      // peuvent filtrer par l'un ou l'autre côté (prestataire/bénéficiaire).
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

  // GET /contracts/:id — l'autorisation partie/admin (404 en cas de refus) est
  // assurée par le middleware contract-metadata en amont.
  getContractById: async ({ params: { id }, req }) => {
    const contract = await getContractByIdUseCase(resolve("contract"))({ id });
    if (!contract) {
      return { status: 404, body: { message: "Contract not found" } };
    }
    return { status: 200, body: toResponse(contract, req.user!.sub) };
  },

  // POST /contracts — crée un contrat. L'appelant est le bénéficiaire (le payeur,
  // dont les points sont mis en séquestre) ; le prestataire réservé vient du body.
  // La recherche de l'annonce, les invariants de réservation et la dérivation
  // côté serveur de districtId/price vivent dans le cas d'usage (testés là-bas).
  createContract: async ({ body, req }) => {
    try {
      const newContract = await createContractUseCase(
        resolve("contract"),
        resolve("listing"),
        resolve("user"),
        documensoService,
        resolve("transaction"),
      )({
        ...body,
        beneficiaryId: req.user!.sub,
        redirectUrl: process.env.CONTRACTS_SIGN_REDIRECT_URL,
      });
      return { status: 201, body: toResponse(newContract, req.user!.sub) };
    } catch (err) {
      // Annonce référencée absente / partie introuvable.
      if (err instanceof ListingNotFoundError || err instanceof ContractPartyNotFoundError) {
        return { status: 404, body: { message: err.message } };
      }
      // Annonce fermée, ou les deux parties sont la même personne.
      if (err instanceof ListingNotActiveError || err instanceof SamePartyError) {
        return { status: 400, body: { message: err.message } };
      }
      // L'appelant a réservé une annonce dont il n'est pas le prestataire.
      if (err instanceof NotListingProviderError) {
        return { status: 403, body: { message: err.message } };
      }
      // Un contrat actif identique existe déjà (double soumission).
      if (err instanceof DuplicateContractError) {
        return { status: 409, body: { message: err.message } };
      }
      // Le bénéficiaire ne peut pas couvrir le prix à mettre en séquestre.
      if (err instanceof InsufficientFundsError) {
        return { status: 400, body: { message: err.message } };
      }
      // Le service de signature électronique a échoué — remonté comme erreur de
      // gateway, pas un 500. On logue la raison sous-jacente (quel appel amont a
      // échoué, et pourquoi) puisque le client ne reçoit qu'un message générique ;
      // c'est la seule trace d'une mauvaise configuration Documenso.
      if (err instanceof DocumensoServiceError) {
        logger.error({ err }, "contract creation failed: Documenso error");
        return { status: 502, body: { message: "The signature service is unavailable, please retry" } };
      }
      throw err;
    }
  },

  // POST /contracts/:id/resend — renvoie l'e-mail de signature. Autorisation
  // réservée aux parties, assurée par le middleware contract-metadata.
  resendContract: async ({ params: { id } }) => {
    const resent = await resendContractUseCase(resolve("contract"), documensoService)({ id });
    if (!resent) {
      return { status: 404, body: { message: "Contract not found" } };
    }
    return { status: 200, body: { resent: true } };
  },

  // POST /contracts/:id/dispute — une partie conteste le contrat (avec motif).
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

  // POST /contracts/:id/resolve-dispute — l'administrateur de quartier tranche le
  // litige (remboursement ou règlement au prestataire). Autorisation réservée à
  // l'administrateur de quartier, assurée par le middleware contract-metadata.
  resolveDispute: async ({ params: { id }, body, req }) => {
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
      // Un remboursement a été demandé sur un contrat dont le séquestre est déjà réglé au prestataire.
      if (err instanceof UnsettleableDisputeError) {
        return { status: 409, body: { message: err.message } };
      }
      throw err;
    }
  },

  // DELETE /contracts/:id — supprime le contrat (transaction pour dénouer le séquestre).
  deleteContract: async ({ params: { id } }) => {
    const deleted = await deleteContractUseCase(resolve("contract"), resolve("transaction"))({ id });
    if (!deleted) {
      return { status: 404, body: { message: "Contract not found" } };
    }
    return { status: 204, body: undefined };
  },
});
