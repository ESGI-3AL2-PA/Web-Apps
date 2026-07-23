import type { Contract } from "../../entities/contract.entity.js";
import type { IContractRepository } from "../../repositories/Contract/contract.repository.js";

/**
 * Cas d'usage : ouverture d'un signalement (dispute) sur un contrat.
 *
 * Ce fichier expose la factory du cas d'usage et l'erreur métier levée quand le contrat
 * n'est pas dans un état contestable.
 */

/** Levée quand le contrat existe mais n'est pas dans un état contestable (→ 400). */
export class InvalidDisputeStateError extends Error {
  constructor() {
    super("Seul un contrat en attente de signature ou signé peut être contesté");
    this.name = "InvalidDisputeStateError";
  }
}

/**
 * Fabrique le cas d'usage de contestation. Renvoie le contrat contesté, `null` s'il
 * n'existe pas (→ 404), ou lève InvalidDisputeStateError s'il n'est pas contestable.
 */
export const disputeContractUseCase = (contractRepository: IContractRepository) => {
  return async (id: string, data: { reason: string }): Promise<Contract | null> => {
    // Écriture unique gardée par l'état : le repository n'appose le signalement que tant
    // que le contrat est pending/completed, ce qui évite une course avec un webhook qui
    // complèterait/rejetterait le contrat entre une lecture et l'écriture (ce qui ferait
    // atterrir un signalement sur un contrat tout juste terminal, ou sur des données périmées).
    const disputed = await contractRepository.disputeContract(id, data.reason);
    if (disputed) return disputed;

    // La garde atomique n'a rien matché. On relit uniquement pour classer la réponse
    // d'erreur — la garde côté argent a déjà joué : absent → null (404) ; présent mais
    // pas dans un état contestable (draft/rejected) → InvalidDisputeStateError (400).
    const existing = await contractRepository.getContractById(id);
    if (!existing) return null;
    throw new InvalidDisputeStateError();
  };
};
