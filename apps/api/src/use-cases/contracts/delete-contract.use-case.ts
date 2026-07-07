import type { IContractRepository } from "../../repositories/Contract/contract.repository.js";
import type { ITransactionRepository } from "../../repositories/Transaction/transaction.repository.js";

// Deletes a contract and, if it was still pending (escrow held, not yet released to
// the provider or refunded), refunds the escrow to the beneficiary. Uses the state
// of the atomically-deleted document so it can't race a completion/rejection.
export const deleteContractUseCase = (
  contractRepository: IContractRepository,
  transactionRepository: ITransactionRepository,
) => {
  return async (params: { id: string }): Promise<boolean> => {
    const deleted = await contractRepository.deleteContract(params.id);
    if (!deleted) return false;

    const escrowStillHeld = deleted.signatureStatus === "pending" || deleted.signatureStatus === "draft";
    if (escrowStillHeld && deleted.price > 0) {
      await transactionRepository.adjustBalance(deleted.beneficiaryId, deleted.price);
      // Ledger row is an audit record; the refund above already settled the escrow.
      // A write failure here must not fail the delete — log for reconciliation.
      await transactionRepository
        .createTransactions([
          {
            userId: deleted.beneficiaryId,
            districtId: deleted.districtId,
            type: "transfer_in",
            amount: deleted.price,
            refId: deleted.id,
            refType: "contract",
          },
        ])
        .catch((err) => console.error(`[contracts] escrow-refund ledger write failed for ${deleted.id}:`, err));
    }
    return true;
  };
};
