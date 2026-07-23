import type { IDistrictRepository } from "../../repositories/District/district.repository.js";

/**
 * Cas d'usage : liste paginée des quartiers.
 * Couche use-case (apps/api). Pass-through vers le repository avec recherche (`search`) et
 * pagination (`page`, `limit`) optionnelles.
 */
export const getDistrictsUseCase = (districtRepository: IDistrictRepository) => {
  return async (params: { search?: string; page?: number; limit?: number }) => {
    return await districtRepository.getDistricts(params);
  };
};
