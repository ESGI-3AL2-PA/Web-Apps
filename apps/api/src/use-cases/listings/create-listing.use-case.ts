import type { CreateListingDto } from "@repo/contracts";
import type { Listing } from "../../entities/listing.entity.js";
import type { IListingRepository } from "../../repositories/Listing/listing.repository.js";

export const createListingUseCase = (listingRepository: IListingRepository) => {
  return async (data: CreateListingDto & { authorId: string; districtId: string }): Promise<Listing> => {
    return await listingRepository.createListing({
      ...data,
      tags: data.tags ?? [],
      status: "active",
    });
  };
};
