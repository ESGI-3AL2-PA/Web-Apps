import type { ListingSort } from "@repo/contracts";
import type { IListingRepository } from "../../repositories/Listing/listing.repository.js";

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
