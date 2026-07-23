import type { IIncidentRepository } from "../../repositories/Incident/incident.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";

/**
 * Cas d'usage : supprimer un signalement.
 *
 * Supprime cote Mongo puis, seulement si la suppression a bien eu lieu, retire
 * le noeud correspondant du graphe (best-effort via syncGraph).
 *
 * @returns true si le signalement existait et a ete supprime.
 */
export const deleteIncidentUseCase = (incidentRepository: IIncidentRepository, graphRepository: IGraphRepository) => {
  return async (params: { id: string }): Promise<boolean> => {
    const deleted = await incidentRepository.deleteIncident(params.id);
    if (deleted) {
      await syncGraph(`deleteIncident(${params.id})`, () => graphRepository.deleteIncident(params.id));
    }
    return deleted;
  };
};
