import type { IIncidentRepository } from "../../repositories/Incident/incident.repository.js";

export const getIncidentsUseCase = (incidentRepository: IIncidentRepository) => {
  return async (params: {
    search?: string;
    status?: string;
    category?: string;
    districtId?: string;
    reporterId?: string;
    assignedTo?: string;
    page?: number;
    limit?: number;
  }) => {
    return await incidentRepository.getIncidents(params);
  };
};
