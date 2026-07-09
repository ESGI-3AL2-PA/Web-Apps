import type { Contract } from "../../entities/contract.entity.js";
import type { IContractRepository } from "../../repositories/Contract/contract.repository.js";

export const disputeContractUseCase = (contractRepository: IContractRepository) => {
  return async (id: string, data: { reason: string }): Promise<Contract | null> => {
    return await contractRepository.updateContract(id, { disputed: true, disputeReason: data.reason });
  };
};
