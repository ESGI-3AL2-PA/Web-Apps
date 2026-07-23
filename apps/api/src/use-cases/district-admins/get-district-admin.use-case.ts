// Cas d'usage (couche district-admins) : récupérer une affectation par son id.
// Simple pass-through vers le repository.
import type { IDistrictAdminRepository } from "../../repositories/DistrictAdmin/district-admin.repository.js";

/**
 * Factory du cas d'usage « récupérer un administrateur de quartier ».
 * @param repo repository des affectations d'administrateurs de quartier
 * @returns une fonction ({ id }) → l'affectation, ou `null` si introuvable.
 */
export const getDistrictAdminUseCase = (repo: IDistrictAdminRepository) => {
  return async ({ id }: { id: string }) => {
    return await repo.getDistrictAdminById(id);
  };
};
