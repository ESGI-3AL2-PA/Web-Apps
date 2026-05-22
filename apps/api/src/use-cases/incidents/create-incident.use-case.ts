import type { CreateIncidentDto } from "@repo/contracts";
import type { Incident } from "../../entities/incident.entity.js";
import type { IIncidentRepository } from "../../repositories/Incident/incident.repository.js";

export const createIncidentUseCase = (incidentRepository: IIncidentRepository) => {
  return async (data: CreateIncidentDto & { reporterId: string }): Promise<Incident> => {
    const now = new Date().toISOString();
    return await incidentRepository.createIncident({
      ...data,
      status: "open",
      history: [
        {
          status: "open",
          updatedBy: data.reporterId,
          updatedAt: now,
        },
      ],
    });
  };
};
