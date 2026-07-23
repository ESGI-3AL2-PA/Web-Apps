import type { IContractRepository } from "../../repositories/Contract/contract.repository.js";

/**
 * Cas d'usage : liste paginée de contrats (pass-through vers le repository).
 *
 * Les filtres sont tous optionnels : par annonce, quartier, prestataire, bénéficiaire,
 * l'une ou l'autre partie (`partyId`), statut de signature ou état de contestation ;
 * `page`/`limit` gouvernent la pagination.
 */
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
