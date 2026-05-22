import type { SignContractDto } from "@repo/contracts";
import type { Contract } from "../../entities/contract.entity.js";
import type { IContractRepository } from "../../repositories/Contract/contract.repository.js";

export const signContractUseCase = (contractRepository: IContractRepository) => {
  return async (id: string, data: SignContractDto): Promise<Contract | null> => {
    return await contractRepository.updateContract(id, {
      openSignDocumentId: data.openSignDocumentId,
      openSignStatus: data.openSignStatus,
    });
  };
};
