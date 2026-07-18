import type { IIncidentRepository } from "../../repositories/Incident/incident.repository.js";

export const getIncidentStatsUseCase = (incidentRepository: IIncidentRepository) => {
  return async (params?: { districtId?: string; reporterId?: string }) => {
    return await incidentRepository.getStats(params);
  };
};
