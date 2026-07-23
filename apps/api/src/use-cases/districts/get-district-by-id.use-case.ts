import type { IDistrictRepository } from "../../repositories/District/district.repository.js";

/**
 * Cas d'usage : récupération d'un quartier par son identifiant.
 * Couche use-case (apps/api). Pass-through vers le repository ; renvoie le quartier ou null.
 */
export const getDistrictByIdUseCase = (districtRepository: IDistrictRepository) => {
  return async (params: { id: string }) => {
    return await districtRepository.getDistrictById(params.id);
  };
};
