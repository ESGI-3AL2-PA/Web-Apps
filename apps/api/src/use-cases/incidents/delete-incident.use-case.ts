import type { IIncidentRepository } from "../../repositories/Incident/incident.repository.js";

export const deleteIncidentUseCase = (incidentRepository: IIncidentRepository) => {
  return async (params: { id: string }): Promise<boolean> => {
    return await incidentRepository.deleteIncident(params.id);
  };
};
