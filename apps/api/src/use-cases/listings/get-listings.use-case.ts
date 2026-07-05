import type { IListingRepository } from "../../repositories/Listing/listing.repository.js";
import type { IContractRepository } from "../../repositories/Contract/contract.repository.js";

export const getListingsUseCase = (listingRepository: IListingRepository, contractRepository: IContractRepository) => {
  return async (params: {
    search?: string;
    type?: string;
    status?: string;
    districtId?: string;
    authorId?: string;
    tag?: string;
    currentUserId?: string;
    page?: number;
    limit?: number;
  }) => {
    const result = await listingRepository.getListings(params);

    if (!params.currentUserId || result.data.length === 0) {
      return result;
    }

    const listingIds = result.data.map((l) => l.id);
    const userContracts = await contractRepository.findByListingsAndBeneficiary(listingIds, params.currentUserId);
    const takenListingIds = new Set(userContracts.map((c) => c.listingId));

    const enriched = result.data.map((l) => ({
      ...l,
      userHasContract: takenListingIds.has(l.id),
    }));

    return { ...result, data: enriched };
  };
};
