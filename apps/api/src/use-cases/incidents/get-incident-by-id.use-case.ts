import type { IIncidentRepository } from "../../repositories/Incident/incident.repository.js";

export const getIncidentByIdUseCase = (incidentRepository: IIncidentRepository) => {
  return async (params: { id: string }) => {
    return await incidentRepository.getIncidentById(params.id);
  };
};
