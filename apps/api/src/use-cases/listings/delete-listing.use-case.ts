import type { IListingRepository } from "../../repositories/Listing/listing.repository.js";

export const deleteListingUseCase = (listingRepository: IListingRepository) => {
  return async (params: { id: string }): Promise<boolean> => {
    return await listingRepository.deleteListing(params.id);
  };
};
