import type { IListingRepository } from "../../repositories/Listing/listing.repository.js";

export const getListingsByIdUseCase = (listingRepository: IListingRepository) => {
  return async (params: { id: string }) => {
    return await listingRepository.getListingsByAuthorId(params.id);
  };
};
