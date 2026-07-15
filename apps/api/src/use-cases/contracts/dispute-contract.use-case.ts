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
    // Single state-gated write: the repo stamps the dispute only while the contract is
    // pending/completed, so it can't race a webhook completing/rejecting the contract
    // between a read and the write (which would let a dispute land on a just-terminal
    // contract or pass on stale data).
    const disputed = await contractRepository.disputeContract(id, data.reason);
    if (disputed) return disputed;

    // The atomic guard didn't match. Read back only to classify the error response —
    // the money-relevant guard already fired: missing → null (404); present but not in a
    // disputable state (draft/rejected) → InvalidDisputeStateError (400).
    const existing = await contractRepository.getContractById(id);
    if (!existing) return null;
    throw new InvalidDisputeStateError();
  };
};
