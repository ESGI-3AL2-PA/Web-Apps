import type { IListingRepository } from "../../repositories/Listing/listing.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";
import { deleteImage, imageKeyFromUrl } from "../../services/image-storage.service.js";

export const deleteListingUseCase = (listingRepository: IListingRepository, graphRepository: IGraphRepository) => {
  return async (params: { id: string }): Promise<boolean> => {
    // Read the images before deletion so we can purge the object storage too.
    const listing = await listingRepository.getListingById(params.id);
    const deleted = await listingRepository.deleteListing(params.id);
    if (deleted) {
      await syncGraph(`deleteListing(${params.id})`, () => graphRepository.deleteListing(params.id));
      const keys = (listing?.images ?? []).map(imageKeyFromUrl).filter((k): k is string => k !== null);
      await Promise.all(keys.map((k) => deleteImage(k)));
    }
    return deleted;
  };
};
