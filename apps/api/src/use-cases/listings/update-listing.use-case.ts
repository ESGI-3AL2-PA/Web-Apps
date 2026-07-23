import type { Listing } from "../../entities/listing.entity.js";
import type { IListingRepository } from "../../repositories/Listing/listing.repository.js";

/**
 * Cas d'usage : mettre a jour une annonce.
 *
 * Passe-plat vers le repository. Le patch exclut `id` et `createdAt` (champs
 * immuables) et n'accepte qu'un sous-ensemble partiel des champs de l'annonce.
 *
 * @returns l'annonce mise a jour, ou null si l'identifiant est introuvable.
 */
export const updateListingUseCase = (listingRepository: IListingRepository) => {
  return async (id: string, data: Partial<Omit<Listing, "id" | "createdAt">>): Promise<Listing | null> => {
    return await listingRepository.updateListing(id, data);
  };
};
