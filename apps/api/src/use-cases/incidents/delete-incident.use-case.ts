import type { IIncidentRepository } from "../../repositories/Incident/incident.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";

export const deleteIncidentUseCase = (incidentRepository: IIncidentRepository, graphRepository: IGraphRepository) => {
  return async (params: { id: string }): Promise<boolean> => {
    const deleted = await incidentRepository.deleteIncident(params.id);
    if (deleted) {
      await syncGraph(`deleteIncident(${params.id})`, () => graphRepository.deleteIncident(params.id));
    }
    return deleted;
  };
};
