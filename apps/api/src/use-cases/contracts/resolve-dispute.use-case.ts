import type { Contract } from "../../entities/contract.entity.js";
import type { IContractRepository } from "../../repositories/Contract/contract.repository.js";

// Clears the disputed flag and its reason (district-admin action). Returns null if
// the contract doesn't exist so the handler can 404.
export const resolveDisputeUseCase = (contractRepository: IContractRepository) => {
  return async ({ id }: { id: string }): Promise<Contract | null> => {
    return await contractRepository.updateContract(id, { disputed: false, disputeReason: null });
  };
};
