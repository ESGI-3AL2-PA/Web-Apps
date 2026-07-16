import type { ClientSession } from "mongodb";
import { logger } from "@repo/server-kit";
import type { Contract } from "../../entities/contract.entity.js";
import type { IContractRepository } from "../../repositories/Contract/contract.repository.js";
import type { ITransactionRepository } from "../../repositories/Transaction/transaction.repository.js";
import { runInTransaction } from "../../repositories/tx.js";

export type DisputeResolution = "release" | "refund";

// A dispute raised *after* the contract already completed leaves the escrow already
// released to the provider. Refunding it would require clawing settled funds back from
// the provider — out of scope for this contained in-transaction path, so we refuse and
// let an operator handle it manually rather than silently move nothing (or double-pay).
export class UnsettleableDisputeError extends Error {
  constructor() {
    super("Impossible de rembourser un contrat déjà réglé — l'escrow a déjà été versé au prestataire");
    this.name = "UnsettleableDisputeError";
  }
}

// Credits `amount` to a user and records the ledger entry — mirrors the webhook
// release path and the delete refund path. Releases the held escrow to the provider
// on `release` or refunds it to the beneficiary on `refund`.
const settle = async (
  transactionRepository: ITransactionRepository,
  contract: Contract,
  userId: string,
  session?: ClientSession,
): Promise<void> => {
  await transactionRepository.adjustBalance(userId, contract.price, session);
  const ledgerWrite = transactionRepository.createTransactions(
    [
      {
        userId,
        districtId: contract.districtId,
        type: "transfer_in",
        amount: contract.price,
        refId: contract.id,
        refType: "contract",
      },
    ],
    session,
  );
  if (session) {
    // Inside a transaction: the dispute clear + balance move + ledger row commit or roll
    // back together, so a ledger failure can't leave the escrow settled without a record.
    await ledgerWrite;
  } else {
    // Sequential fallback (standalone Mongo): the balance move already settled the escrow
    // and the atomic resolve gate fired, so keep the ledger write best-effort.
    await ledgerWrite.catch((err) =>
      logger.error({ err, contractId: contract.id }, "[contracts] dispute-settle ledger write failed"),
    );
  }
};

// Resolves a dispute per the admin's choice: `release` settles the escrow to the
// provider, `refund` returns it to the beneficiary. The chosen settlement + the flag
// clear + the terminal transition all happen atomically inside runInTransaction, with
// the matching ledger entry. Returns null if the contract isn't disputed (→ 404).
export const resolveDisputeUseCase = (
  contractRepository: IContractRepository,
  transactionRepository: ITransactionRepository,
) => {
  return async ({ id, resolution }: { id: string; resolution: DisputeResolution }): Promise<Contract | null> => {
    // Refuse a refund of an already-settled (completed) contract up front — before any
    // write, so there's no half-applied state in the standalone (no-transaction) path.
    // A disputed contract is frozen (the webhook can't complete it while disputed), so
    // this read is stable against a concurrent settlement.
    if (resolution === "refund") {
      const current = await contractRepository.getContractById(id);
      if (current?.disputed && current.signatureStatus === "completed") {
        throw new UnsettleableDisputeError();
      }
    }

    return runInTransaction(async (session) => {
      const terminalStatus = resolution === "release" ? "completed" : "rejected";
      // Atomically clear the dispute + move to the terminal state, returning the contract's
      // pre-resolution state so we know whether the escrow was still held.
      const before = await contractRepository.resolveDispute(id, terminalStatus, session);
      if (!before) return null;

      const escrowHeld = before.signatureStatus === "pending" || before.signatureStatus === "draft";
      if (before.price > 0 && escrowHeld) {
        const payee = resolution === "release" ? before.providerId : before.beneficiaryId;
        await settle(transactionRepository, before, payee, session);
      }
      // Escrow not held (contract completed before the dispute) → the provider already
      // holds the funds: `release` needs no move, `refund` was refused above.

      return {
        ...before,
        disputed: false,
        disputeReason: null,
        signatureStatus: terminalStatus,
        providerSigningUrl: null,
        beneficiarySigningUrl: null,
      };
    });
  };
};
