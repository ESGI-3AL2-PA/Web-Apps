import type { UpdateIncidentDto } from "@repo/contracts";
import type { Incident, IncidentHistoryEntry } from "../../entities/incident.entity.js";
import type { IIncidentRepository } from "../../repositories/Incident/incident.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";

export const updateIncidentUseCase = (incidentRepository: IIncidentRepository, graphRepository: IGraphRepository) => {
  return async (id: string, data: UpdateIncidentDto, actorId: string): Promise<Incident | null> => {
    const existing = await incidentRepository.getIncidentById(id);
    if (!existing) return null;

    const { historyNote, ...rest } = data;

    const update: Partial<Omit<Incident, "id" | "createdAt" | "updatedAt">> = { ...rest };

    // Append a history entry whenever the status changes (or an explicit note is provided)
    if (rest.status && rest.status !== existing.status) {
      const entry: IncidentHistoryEntry = {
        status: rest.status,
        note: historyNote,
        updatedBy: actorId,
        updatedAt: new Date().toISOString(),
      };
      update.history = [...existing.history, entry];
    }

    const incident = await incidentRepository.updateIncident(id, update);

    // Refresh the projected node fields (status / category) if they changed.
    if (incident && (rest.status !== undefined || rest.category !== undefined)) {
      await syncGraph(`upsertIncident(${incident.id})`, () =>
        graphRepository.upsertIncident({
          id: incident.id,
          category: incident.category,
          status: incident.status,
        }),
      );
    }

    return incident;
  };
};
