import type { Contract } from "../../entities/contract.entity.js";
import type { IContractRepository } from "../../repositories/Contract/contract.repository.js";

export const disputeContractUseCase = (contractRepository: IContractRepository) => {
  return async (id: string, _data: { reason: string }): Promise<Contract | null> => {
    // The reason is accepted in the payload but not persisted on the contract yet
    // (no dedicated field in the MCD). A dedicated DISPUTES collection can be added later.
    return await contractRepository.updateContract(id, { disputed: true });
  };
};
