import type { IContractRepository } from "../../repositories/Contract/contract.repository.js";

export const deleteContractUseCase = (contractRepository: IContractRepository) => {
  return async (params: { id: string }): Promise<boolean> => {
    return await contractRepository.deleteContract(params.id);
  };
};
