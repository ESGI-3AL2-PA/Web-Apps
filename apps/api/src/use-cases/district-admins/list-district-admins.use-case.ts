// Cas d'usage (couche district-admins) : liste paginée des affectations, filtrable par
// quartier et/ou utilisateur. Simple pass-through vers le repository.
import type { IDistrictAdminRepository } from "../../repositories/DistrictAdmin/district-admin.repository.js";

/**
 * Factory du cas d'usage « lister les administrateurs de quartier ».
 * @param repo repository des affectations d'administrateurs de quartier
 * @returns une fonction (filtres districtId/userId + pagination) → page d'affectations.
 */
export const listDistrictAdminsUseCase = (repo: IDistrictAdminRepository) => {
  return async (params: { districtId?: string; userId?: string; page?: number; limit?: number }) => {
    return await repo.listDistrictAdmins(params);
  };
};
