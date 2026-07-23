import type { ClientSession } from "mongodb";
import type { Contract } from "../../entities/contract.entity.js";
import type { IContractRepository } from "../../repositories/Contract/contract.repository.js";
import { logger } from "../../logger.js";
import type { ITransactionRepository } from "../../repositories/Transaction/transaction.repository.js";
import { runInTransaction } from "../../repositories/tx.js";
import { mapDocumensoStatus, type DocumensoWebhookEvent } from "../../services/documenso.service.js";

/**
 * Cas d'usage : traitement d'un webhook Documenso (événements de signature).
 *
 * Ce fichier expose la factory du cas d'usage et un helper `credit` de crédit + écriture
 * de journal, partagé par les transitions de complétion et de rejet.
 */

// Crédite le prix du contrat à un utilisateur et enregistre l'écriture de journal
// (ledger). Sert à verser le séquestre au prestataire à la complétion, ou à le
// rembourser au bénéficiaire au rejet.
const credit = async (
  transactionRepository: ITransactionRepository,
  contract: Contract,
  userId: string,
  session?: ClientSession,
): Promise<void> => {
  if (contract.price <= 0) return;
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
    // Dans une transaction : la garde de statut + le mouvement de solde + l'écriture de
    // journal sont validés ou annulés ensemble, si bien qu'un échec de journal ne peut pas
    // laisser le séquestre réglé sans trace.
    await ledgerWrite;
  } else {
    // Repli séquentiel (Mongo autonome, sans transactions) : le mouvement de solde a déjà
    // réglé le séquestre et la garde atomique a joué, donc on garde l'écriture de journal
    // en best-effort — un échec ici ne doit pas faire 500 le webhook et provoquer un
    // re-crédit lors du renvoi (retry).
    await ledgerWrite.catch((err) =>
      logger.error({ err, contractId: contract.id }, "escrow-settle ledger write failed"),
    );
  }
};

/**
 * Fabrique le cas d'usage de traitement du webhook Documenso.
 *
 * Fait correspondre un événement Documenso entrant à une transition de statut du contrat.
 * Idempotent : les gardes atomiques complete/reject garantissent que le séquestre est
 * versé ou remboursé au plus une fois, même si le même événement est livré deux fois.
 * Renvoie `null` quand l'événement ne peut être rattaché à aucun contrat, pour que le
 * handler puisse quand même répondre 200 au webhook.
 */
export const handleDocumensoWebhookUseCase = (
  contractRepository: IContractRepository,
  transactionRepository: ITransactionRepository,
) => {
  return async (event: DocumensoWebhookEvent): Promise<Contract | null> => {
    const documentId = event.payload?.id;
    if (typeof documentId !== "number") return null;

    const contract = await contractRepository.getContractByDocumensoDocumentId(documentId);
    if (!contract) return null;

    const signatureStatus = mapDocumensoStatus(event.payload?.status);
    // Événement inconnu/non géré — on l'ignore (on ne touche pas au contrat).
    if (signatureStatus === null) return contract;

    if (signatureStatus === "completed") {
      // Les deux parties ont signé — transition atomique + versement du séquestre au
      // prestataire (une seule fois). Garde + solde + journal validés ensemble.
      const completed = await runInTransaction(async (session) => {
        const c = await contractRepository.completeContract(contract.id, session);
        if (c) await credit(transactionRepository, c, c.providerId, session);
        return c;
      });
      return completed ?? contract;
    }

    if (signatureStatus === "rejected") {
      // Une partie a refusé — transition atomique + remboursement du séquestre au
      // bénéficiaire (une seule fois).
      const rejected = await runInTransaction(async (session) => {
        const c = await contractRepository.rejectContract(contract.id, session);
        if (c) await credit(transactionRepository, c, c.beneficiaryId, session);
        return c;
      });
      return rejected ?? contract;
    }

    // Transition non terminale (pending/draft) : appliquée atomiquement uniquement tant
    // que le contrat n'est pas terminal, pour qu'un événement tardif ou dans le désordre
    // ne puisse pas ramener un contrat completed/rejected à pending. Déjà terminal → no-op.
    const updated = await contractRepository.applyNonTerminalStatus(contract.id, signatureStatus);
    return updated ?? contract;
  };
};
