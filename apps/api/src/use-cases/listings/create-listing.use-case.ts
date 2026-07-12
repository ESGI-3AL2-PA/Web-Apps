import type { CreateListingDto } from "@repo/contracts";
import type { Listing } from "../../entities/listing.entity.js";
import type { IListingRepository } from "../../repositories/Listing/listing.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";

export const createListingUseCase = (listingRepository: IListingRepository, graphRepository: IGraphRepository) => {
  return async (data: CreateListingDto & { authorId: string; districtId: string }): Promise<Listing> => {
    const listing = await listingRepository.createListing({
      ...data,
      tags: data.tags ?? [],
      status: "active",
    });

    // Mirror the listing into the graph: node + author + tag edges.
    await syncGraph(`upsertListing(${listing.id})`, () =>
      graphRepository.upsertListing({ id: listing.id, type: listing.type }),
    );
    if (listing.authorId) {
      await syncGraph(`linkUserPublishedListing(${listing.authorId}->${listing.id})`, () =>
        graphRepository.linkUserPublishedListing(listing.authorId, listing.id),
      );
    }
    for (const tag of listing.tags ?? []) {
      await syncGraph(`linkListingTagged(${listing.id},${tag})`, () =>
        graphRepository.linkListingTagged(listing.id, tag),
      );
    }
    return listing;
  };
};
