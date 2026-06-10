import type { IContractRepository } from "../../repositories/Contract/contract.repository.js";

export const getContractsUseCase = (contractRepository: IContractRepository) => {
  return async (params: {
    listingId?: string;
    providerId?: string;
    beneficiaryId?: string;
    partyId?: string;
    openSignStatus?: string;
    disputed?: boolean;
    page?: number;
    limit?: number;
  }) => {
    return await contractRepository.getContracts(params);
  };
};
