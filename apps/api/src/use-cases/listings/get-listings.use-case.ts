import type { ListingSort } from "@repo/contracts";
import type { IListingRepository } from "../../repositories/Listing/listing.repository.js";

/**
 * Cas d'usage : lister les annonces avec filtres, tri et pagination.
 *
 * Passe-plat vers le repository. Tous les parametres sont optionnels :
 * recherche plein texte, statut, quartier, auteur, tag, ordre de tri
 * (`sort`), et `page`/`limit`.
 */
export const getListingsUseCase = (listingRepository: IListingRepository) => {
  return async (params: {
    search?: string;
    status?: string;
    districtId?: string;
    authorId?: string;
    tag?: string;
    sort?: ListingSort;
    page?: number;
    limit?: number;
  }) => {
    return await listingRepository.getListings(params);
  };
};
