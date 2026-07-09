import type { Contract } from "../../entities/contract.entity.js";
import type { IContractRepository } from "../../repositories/Contract/contract.repository.js";

export class InvalidDisputeStateError extends Error {
  constructor() {
    super("Seul un contrat en attente de signature ou signé peut être contesté");
    this.name = "InvalidDisputeStateError";
  }
}

export const disputeContractUseCase = (contractRepository: IContractRepository) => {
  return async (id: string, data: { reason: string }): Promise<Contract | null> => {
    const existing = await contractRepository.getContractById(id);
    if (!existing) return null;
    // Un litige ne peut porter que sur un contrat en cours de signature ou déjà signé —
    // pas sur un brouillon jamais envoyé ni un contrat refusé.
    if (existing.signatureStatus !== "pending" && existing.signatureStatus !== "completed") {
      throw new InvalidDisputeStateError();
    }
    return await contractRepository.updateContract(id, { disputed: true, disputeReason: data.reason });
  };
};
