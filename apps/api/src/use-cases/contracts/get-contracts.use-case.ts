import type { IContractRepository } from "../../repositories/Contract/contract.repository.js";

export const getContractsUseCase = (contractRepository: IContractRepository) => {
  return async (params: {
    listingId?: string;
    districtId?: string;
    providerId?: string;
    beneficiaryId?: string;
    partyId?: string;
    signatureStatus?: string;
    disputed?: boolean;
    page?: number;
    limit?: number;
  }) => {
    return await contractRepository.getContracts(params);
  };
};
