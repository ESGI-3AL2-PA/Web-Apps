import type { IContractRepository } from "../../repositories/Contract/contract.repository.js";

export const getContractByIdUseCase = (contractRepository: IContractRepository) => {
  return async (params: { id: string }) => {
    return await contractRepository.getContractById(params.id);
  };
};
