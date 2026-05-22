import type { IIncidentRepository } from "../../repositories/Incident/incident.repository.js";

export const getIncidentStatsUseCase = (incidentRepository: IIncidentRepository) => {
  return async () => {
    return await incidentRepository.getStats();
  };
};
