import type { IDistrictRepository } from "../../repositories/District/district.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";

/**
 * Cas d'usage : suppression d'un quartier.
 * Couche use-case (apps/api). Supprime le quartier dans Mongo puis, seulement si la suppression
 * a bien eu lieu, retire le noeud correspondant du graphe (projection best-effort).
 */
export const deleteDistrictUseCase = (districtRepository: IDistrictRepository, graphRepository: IGraphRepository) => {
  return async (params: { id: string }): Promise<boolean> => {
    const deleted = await districtRepository.deleteDistrict(params.id);
    // On ne touche au graphe que si Mongo a effectivement supprimé quelque chose.
    if (deleted) {
      await syncGraph(`deleteDistrict(${params.id})`, () => graphRepository.deleteDistrict(params.id));
    }
    return deleted;
  };
};
