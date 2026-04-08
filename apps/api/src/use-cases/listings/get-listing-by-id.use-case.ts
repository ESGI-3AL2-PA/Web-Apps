import type { IListingRepository } from "../../repositories/Listing/listing.repository.js";

export const getListingByIdUseCase = (listingRepository: IListingRepository) => {
  return async (params: { id: string }) => {
    return await listingRepository.getListingById(params.id);
  };
};
