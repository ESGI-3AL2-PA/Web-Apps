import type { IListingRepository } from "../../repositories/Listing/listing.repository.js";

/**
 * Cas d'usage : recuperer une annonce par identifiant.
 * Passe-plat vers le repository ; renvoie null si introuvable.
 */
export const getListingByIdUseCase = (listingRepository: IListingRepository) => {
  return async (params: { id: string }) => {
    return await listingRepository.getListingById(params.id);
  };
};
