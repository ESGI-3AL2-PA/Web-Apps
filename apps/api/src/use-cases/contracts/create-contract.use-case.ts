import type { CreateContractDto } from "@repo/contracts";
import type { Contract } from "../../entities/contract.entity.js";
import type { IContractRepository } from "../../repositories/Contract/contract.repository.js";
import { logger } from "../../logger.js";
import type { IUserRepository } from "../../repositories/User/user.repository.js";
import type { ITransactionRepository } from "../../repositories/Transaction/transaction.repository.js";
import type { IDocumensoService } from "../../services/documenso.service.js";

export class ContractPartyNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContractPartyNotFoundError";
  }
}

export class InsufficientFundsError extends Error {
  constructor() {
    super("Insufficient balance to escrow the contract price");
    this.name = "InsufficientFundsError";
  }
}

export class DuplicateContractError extends Error {
  constructor() {
    super("An active contract already exists for this listing and parties");
    this.name = "DuplicateContractError";
  }
}

// A MongoServerError with code 11000 is a unique-index violation — here, the partial
// unique index on (listingId, providerId, beneficiaryId) for pending contracts.
const isDuplicateKeyError = (err: unknown): boolean =>
  typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;

// The caller is the beneficiary (payer). Their tokens are escrowed up front — held
// until the contract completes (released to the provider) or is rejected/deleted
// (refunded). Generating the Documenso document and persisting the contract happen
// after the hold; if either fails the hold is rolled back.
export const createContractUseCase = (
  contractRepository: IContractRepository,
  userRepository: IUserRepository,
  documenso: IDocumensoService,
  transactionRepository: ITransactionRepository,
) => {
  return async (
    // `price` is derived server-side from the listing by the caller (router), never
    // taken from the client, so the escrowed amount always matches the listing.
    data: CreateContractDto & { beneficiaryId: string; districtId: string; price: number; redirectUrl?: string },
  ): Promise<Contract> => {
    const [provider, beneficiary] = await Promise.all([
      userRepository.getUserById(data.providerId),
      userRepository.getUserById(data.beneficiaryId),
    ]);
    if (!provider) throw new ContractPartyNotFoundError("Provider not found");
    if (!beneficiary) throw new ContractPartyNotFoundError("Beneficiary not found");

    // Reject an accidental double-submit before touching money — a second identical
    // contract would escrow the price again against the same booking.
    const existing = await contractRepository.findActiveContract({
      listingId: data.listingId,
      providerId: data.providerId,
      beneficiaryId: data.beneficiaryId,
    });
    if (existing) throw new DuplicateContractError();

    // Escrow the price from the beneficiary before doing any external work.
    if (data.price > 0) {
      const held = await transactionRepository.tryDebit(data.beneficiaryId, data.price);
      if (!held) throw new InsufficientFundsError();
    }

    // Everything from the hold up to a persisted contract must roll the hold back on
    // failure (nothing durable exists yet). Once the contract row exists the hold is
    // correctly captured, so a later ledger hiccup must NOT refund a live contract.
    let contract: Contract;
    try {
      const document = await documenso.generateContractDocument({
        title: `Contrat — annonce ${data.listingId}`,
        provider: { email: provider.email, name: `${provider.firstName} ${provider.lastName}` },
        beneficiary: { email: beneficiary.email, name: `${beneficiary.firstName} ${beneficiary.lastName}` },
        redirectUrl: data.redirectUrl,
      });

      contract = await contractRepository.createContract({
        listingId: data.listingId,
        districtId: data.districtId,
        providerId: data.providerId,
        beneficiaryId: data.beneficiaryId,
        price: data.price,
        documensoDocumentId: document.documentId,
        signatureStatus: "pending",
        providerSigningUrl: document.providerSigningUrl,
        beneficiarySigningUrl: document.beneficiarySigningUrl,
        disputed: false,
        disputeReason: null,
      });
    } catch (err) {
      // Roll the escrow hold back — no contract was persisted. Best-effort so a failed
      // refund can't mask the original error (the more useful one to surface).
      if (data.price > 0) {
        await transactionRepository
          .adjustBalance(data.beneficiaryId, data.price)
          .catch((refundErr) =>
            logger.error(
              { err: refundErr, beneficiaryId: data.beneficiaryId },
              "escrow rollback failed for beneficiary",
            ),
          );
      }
      // A concurrent identical create won the unique-index race (both passed the
      // findActiveContract check above) — surface it as a 409, not a 500.
      if (isDuplicateKeyError(err)) throw new DuplicateContractError();
      throw err;
    }

    // Record the escrow-hold ledger entry now that the contract exists to reference
    // it. The money is already correctly held and the contract is live, so a ledger
    // write failure here must not roll anything back — log it for reconciliation.
    if (data.price > 0) {
      await transactionRepository
        .createTransactions([
          {
            userId: data.beneficiaryId,
            districtId: data.districtId,
            type: "transfer_out",
            // Signed = effect on this row's own balance: an escrow hold debits the
            // payer, so it's negative (matching create-transaction's transfer_out).
            amount: -data.price,
            refId: contract.id,
            refType: "contract",
          },
        ])
        .catch((err) => logger.error({ err, contractId: contract.id }, "escrow-hold ledger write failed"));
    }
    return contract;
  };
};
