import type { IListingRepository } from "../../repositories/Listing/listing.repository.js";

export const getListingsUseCase = (listingRepository: IListingRepository) => {
  return async (params: {
    search?: string;
    type?: string;
    status?: string;
    districtId?: string;
    authorId?: string;
    page?: number;
    limit?: number;
  }) => {
    return await listingRepository.getListings(params);
  };
};
