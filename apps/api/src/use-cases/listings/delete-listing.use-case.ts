import type { IListingRepository } from "../../repositories/Listing/listing.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";

export const deleteListingUseCase = (
  listingRepository: IListingRepository,
  graphRepository: IGraphRepository,
) => {
  return async (params: { id: string }): Promise<boolean> => {
    const deleted = await listingRepository.deleteListing(params.id);
    if (deleted) {
      await syncGraph(`deleteListing(${params.id})`, () => graphRepository.deleteListing(params.id));
    }
    return deleted;
  };
};
