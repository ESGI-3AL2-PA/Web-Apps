import type { CreateListingDto } from "@repo/contracts";
import type { Listing } from "../../entities/listing.entity.js";
import type { IListingRepository } from "../../repositories/Listing/listing.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";

/**
 * Cas d'usage : creer une annonce.
 *
 * Cree l'annonce en statut « active » (tags et images par defaut a vide), puis
 * la miroite dans le graphe : noeud + arete auteur + une arete par tag. La
 * categorie du noeud graphe est le premier tag de l'annonce.
 *
 * @param data DTO de creation etendu de `authorId` et `districtId` (resolus depuis le contexte auth).
 * @returns l'annonce creee.
 */
export const createListingUseCase = (listingRepository: IListingRepository, graphRepository: IGraphRepository) => {
  return async (data: CreateListingDto & { authorId: string; districtId: string }): Promise<Listing> => {
    const listing = await listingRepository.createListing({
      ...data,
      tags: data.tags ?? [],
      images: data.images ?? [],
      status: "active",
    });

    // Miroir de l'annonce dans le graphe : noeud + aretes auteur et tags.
    await syncGraph(`upsertListing(${listing.id})`, () =>
      graphRepository.upsertListing({ id: listing.id, category: listing.tags[0] }),
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
