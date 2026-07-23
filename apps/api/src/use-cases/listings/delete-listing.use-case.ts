import type { IListingRepository } from "../../repositories/Listing/listing.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";
import { deleteImage, imageKeyFromUrl } from "../../services/image-storage.service.js";

/**
 * Cas d'usage : supprimer une annonce.
 *
 * Supprime cote Mongo, puis, si la suppression a eu lieu, retire le noeud du
 * graphe et purge les images associees du stockage objet (MinIO). Les cles
 * d'objet sont derivees des URLs d'images ; celles non reconnues (null) sont
 * ignorees.
 *
 * @returns true si l'annonce existait et a ete supprimee.
 */
export const deleteListingUseCase = (listingRepository: IListingRepository, graphRepository: IGraphRepository) => {
  return async (params: { id: string }): Promise<boolean> => {
    // Lit les images avant suppression pour pouvoir aussi purger le stockage objet.
    const listing = await listingRepository.getListingById(params.id);
    const deleted = await listingRepository.deleteListing(params.id);
    if (deleted) {
      await syncGraph(`deleteListing(${params.id})`, () => graphRepository.deleteListing(params.id));
      // Convertit chaque URL d'image en cle d'objet, en ecartant les URLs non reconnues.
      const keys = (listing?.images ?? []).map(imageKeyFromUrl).filter((k): k is string => k !== null);
      await Promise.all(keys.map((k) => deleteImage(k)));
    }
    return deleted;
  };
};
