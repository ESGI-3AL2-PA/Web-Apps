import type { CreateIncidentDto } from "@repo/contracts";
import type { Incident } from "../../entities/incident.entity.js";
import type { IIncidentRepository } from "../../repositories/Incident/incident.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";

export const createIncidentUseCase = (incidentRepository: IIncidentRepository, graphRepository: IGraphRepository) => {
  return async (data: CreateIncidentDto & { reporterId: string }): Promise<Incident> => {
    const now = new Date().toISOString();
    const incident = await incidentRepository.createIncident({
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

    // Mirror to the graph: node + reporter + district edges.
    await syncGraph(`upsertIncident(${incident.id})`, () =>
      graphRepository.upsertIncident({
        id: incident.id,
        category: incident.category,
        status: incident.status,
      }),
    );
    if (incident.reporterId) {
      await syncGraph(`linkUserReportedIncident(${incident.reporterId}->${incident.id})`, () =>
        graphRepository.linkUserReportedIncident(incident.reporterId, incident.id),
      );
    }
    if (incident.districtId) {
      await syncGraph(`linkDistrictContainsIncident(${incident.districtId}->${incident.id})`, () =>
        graphRepository.linkDistrictContainsIncident(incident.districtId, incident.id),
      );
    }
    return incident;
  };
};
