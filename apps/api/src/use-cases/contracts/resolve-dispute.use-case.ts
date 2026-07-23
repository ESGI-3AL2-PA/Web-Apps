import type { ClientSession } from "mongodb";
import { logger } from "@repo/shared";
import type { Contract } from "../../entities/contract.entity.js";
import type { IContractRepository } from "../../repositories/Contract/contract.repository.js";
import type { ITransactionRepository } from "../../repositories/Transaction/transaction.repository.js";
import { runInTransaction } from "../../repositories/tx.js";

/**
 * Cas d'usage : résolution d'un signalement (dispute) par un administrateur.
 *
 * Ce fichier expose la factory du cas d'usage, l'erreur métier UnsettleableDisputeError
 * et un helper `settle` de règlement + écriture de journal.
 */

/** Sens de résolution : `release` verse le séquestre au prestataire, `refund` le rembourse au bénéficiaire. */
export type DisputeResolution = "release" | "refund";

// Un signalement ouvert *après* que le contrat est déjà terminé laisse le séquestre
// déjà versé au prestataire. Le rembourser exigerait de reprendre des fonds déjà réglés
// au prestataire — hors du périmètre de ce chemin transactionnel contenu ; on refuse
// donc et on laisse un opérateur traiter le cas manuellement, plutôt que de ne rien
// déplacer en silence (ou de payer deux fois).
export class UnsettleableDisputeError extends Error {
  constructor() {
    super("Impossible de rembourser un contrat déjà réglé — l'escrow a déjà été versé au prestataire");
    this.name = "UnsettleableDisputeError";
  }
}

// Crédite le prix du contrat à un utilisateur et enregistre l'écriture de journal —
// reflète le chemin de versement du webhook et le chemin de remboursement de la
// suppression. Verse le séquestre bloqué au prestataire (`release`) ou le rembourse au
// bénéficiaire (`refund`).
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
    // Dans une transaction : la levée du signalement + le mouvement de solde + l'écriture
    // de journal sont validés ou annulés ensemble, si bien qu'un échec de journal ne peut
    // pas laisser le séquestre réglé sans trace.
    await ledgerWrite;
  } else {
    // Repli séquentiel (Mongo autonome) : le mouvement de solde a déjà réglé le séquestre
    // et la garde atomique de résolution a joué, donc on garde l'écriture de journal en best-effort.
    await ledgerWrite.catch((err) =>
      logger.error({ err, contractId: contract.id }, "[contracts] dispute-settle ledger write failed"),
    );
  }
};

/**
 * Fabrique le cas d'usage de résolution de signalement.
 *
 * Résout un signalement selon le choix de l'administrateur : `release` verse le séquestre
 * au prestataire, `refund` le rend au bénéficiaire. Le règlement choisi + la levée du
 * drapeau de contestation + la transition vers l'état terminal se font tous atomiquement
 * dans runInTransaction, avec l'écriture de journal correspondante. Renvoie `null` si le
 * contrat n'est pas contesté (→ 404), ou lève UnsettleableDisputeError sur un refund d'un
 * contrat déjà réglé.
 */
export const resolveDisputeUseCase = (
  contractRepository: IContractRepository,
  transactionRepository: ITransactionRepository,
) => {
  return async ({ id, resolution }: { id: string; resolution: DisputeResolution }): Promise<Contract | null> => {
    // Refuse d'emblée le remboursement d'un contrat déjà réglé (completed) — avant toute
    // écriture, pour qu'il n'y ait pas d'état à moitié appliqué dans le chemin autonome
    // (sans transaction). Un contrat contesté est gelé (le webhook ne peut pas le compléter
    // tant qu'il est contesté), donc cette lecture est stable face à un règlement concurrent.
    if (resolution === "refund") {
      const current = await contractRepository.getContractById(id);
      if (current?.disputed && current.signatureStatus === "completed") {
        throw new UnsettleableDisputeError();
      }
    }

    return runInTransaction(async (session) => {
      const terminalStatus = resolution === "release" ? "completed" : "rejected";
      // Lève atomiquement le signalement + passe à l'état terminal, en renvoyant l'état
      // *pré-résolution* du contrat pour savoir si le séquestre était encore bloqué.
      const before = await contractRepository.resolveDispute(id, terminalStatus, session);
      if (!before) return null;

      const escrowHeld = before.signatureStatus === "pending" || before.signatureStatus === "draft";
      if (before.price > 0 && escrowHeld) {
        const payee = resolution === "release" ? before.providerId : before.beneficiaryId;
        await settle(transactionRepository, before, payee, session);
      }
      // Séquestre non bloqué (contrat terminé avant le signalement) → le prestataire
      // détient déjà les fonds : `release` ne nécessite aucun mouvement, `refund` a été
      // refusé plus haut.

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
