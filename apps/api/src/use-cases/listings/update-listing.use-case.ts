import type { Listing } from "../../entities/listing.entity.js";
import type { IListingRepository } from "../../repositories/Listing/listing.repository.js";

export const updateListingUseCase = (listingRepository: IListingRepository) => {
  return async (id: string, data: Partial<Omit<Listing, "id" | "createdAt">>): Promise<Listing | null> => {
    return await listingRepository.updateListing(id, data);
  };
};
