import type { IContractRepository } from "../../repositories/Contract/contract.repository.js";
import type { ITransactionRepository } from "../../repositories/Transaction/transaction.repository.js";
import { runInTransaction } from "../../repositories/tx.js";
import { logger } from "../../logger.js";

/**
 * Cas d'usage : suppression d'un contrat.
 *
 * Supprime un contrat et, s'il était encore en attente (séquestre bloqué, pas encore
 * versé au prestataire ni remboursé), rembourse le séquestre au bénéficiaire. S'appuie
 * sur l'état du document supprimé atomiquement, ce qui empêche une course avec une
 * complétion/un rejet. La suppression + le remboursement + l'écriture de journal sont
 * validés ensemble lorsque les transactions Mongo sont disponibles.
 *
 * @returns Un handler renvoyant `true` si un contrat a été supprimé, `false` s'il
 *   n'existait pas (→ 404).
 */
export const deleteContractUseCase = (
  contractRepository: IContractRepository,
  transactionRepository: ITransactionRepository,
) => {
  return async (params: { id: string }): Promise<boolean> => {
    return runInTransaction(async (session) => {
      const deleted = await contractRepository.deleteContract(params.id, session);
      if (!deleted) return false;

      // Le séquestre n'est encore bloqué que tant que le contrat n'est pas terminal
      // (états "pending"/"draft") ; s'il est completed/rejected, l'argent a déjà bougé.
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
          await ledgerWrite; // atomique avec la suppression + le remboursement
        } else {
          // Repli séquentiel : le remboursement est déjà appliqué ; on garde l'écriture de
          // journal en best-effort.
          await ledgerWrite.catch((err) =>
            logger.error({ err, contractId: deleted.id }, "escrow-refund ledger write failed"),
          );
        }
      }
      return true;
    });
  };
};
