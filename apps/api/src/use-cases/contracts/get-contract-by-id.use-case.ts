import type { IContractRepository } from "../../repositories/Contract/contract.repository.js";

/**
 * Cas d'usage : récupération d'un contrat par son id (pass-through vers le repository).
 * Renvoie le contrat ou `null` s'il n'existe pas.
 */
export const getContractByIdUseCase = (contractRepository: IContractRepository) => {
  return async (params: { id: string }) => {
    return await contractRepository.getContractById(params.id);
  };
};
