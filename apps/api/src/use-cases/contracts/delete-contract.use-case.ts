import type { IContractRepository } from "../../repositories/Contract/contract.repository.js";
import type { ITransactionRepository } from "../../repositories/Transaction/transaction.repository.js";
import { runInTransaction } from "../../repositories/tx.js";

// Deletes a contract and, if it was still pending (escrow held, not yet released to
// the provider or refunded), refunds the escrow to the beneficiary. Uses the state
// of the atomically-deleted document so it can't race a completion/rejection. The
// delete + refund + ledger row commit together when Mongo transactions are available.
export const deleteContractUseCase = (
  contractRepository: IContractRepository,
  transactionRepository: ITransactionRepository,
) => {
  return async (params: { id: string }): Promise<boolean> => {
    return runInTransaction(async (session) => {
      const deleted = await contractRepository.deleteContract(params.id, session);
      if (!deleted) return false;

      const escrowStillHeld = deleted.signatureStatus === "pending" || deleted.signatureStatus === "draft";
      if (escrowStillHeld && deleted.price > 0) {
        await transactionRepository.adjustBalance(deleted.beneficiaryId, deleted.price, session);
        const ledgerWrite = transactionRepository.createTransactions(
          [
            {
              userId: deleted.beneficiaryId,
              districtId: deleted.districtId,
              type: "transfer_in",
              amount: deleted.price,
              refId: deleted.id,
              refType: "contract",
            },
          ],
          session,
        );
        if (session) {
          await ledgerWrite; // atomic with the delete + refund
        } else {
          // Sequential fallback: the refund already settled; keep the ledger best-effort.
          await ledgerWrite.catch((err) =>
            console.error(`[contracts] escrow-refund ledger write failed for ${deleted.id}:`, err),
          );
        }
      }
      return true;
    });
  };
};
