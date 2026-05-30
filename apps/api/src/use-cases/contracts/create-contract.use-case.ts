import type { CreateContractDto } from "@repo/contracts";
import type { Contract } from "../../entities/contract.entity.js";
import type { IContractRepository } from "../../repositories/Contract/contract.repository.js";

export const createContractUseCase = (contractRepository: IContractRepository) => {
  return async (data: CreateContractDto): Promise<Contract> => {
    return await contractRepository.createContract({
      ...data,
      openSignDocumentId: "",
      openSignStatus: "draft",
      disputed: false,
    });
  };
};
