import type { UpdateIncidentDto } from "@repo/contracts";
import type { Incident, IncidentHistoryEntry } from "../../entities/incident.entity.js";
import type { IIncidentRepository } from "../../repositories/Incident/incident.repository.js";
import type { IUserRepository } from "../../repositories/User/user.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";

export type UpdateIncidentResult =
  | { kind: "not-found" }
  | { kind: "invalid-assignee" }
  | { kind: "ok"; incident: Incident };

export const updateIncidentUseCase = (
  incidentRepository: IIncidentRepository,
  userRepository: IUserRepository,
  graphRepository: IGraphRepository,
) => {
  return async (id: string, data: UpdateIncidentDto, actorId: string): Promise<UpdateIncidentResult> => {
    const existing = await incidentRepository.getIncidentById(id);
    if (!existing) return { kind: "not-found" };

    const { historyNote, ...rest } = data;

    // Incidents can only be assigned to an admin (the district's handlers), never to a regular user.
    if (rest.assignedTo) {
      const assignee = await userRepository.getUserById(rest.assignedTo);
      if (!assignee || assignee.role !== "admin") return { kind: "invalid-assignee" };
    }

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
    if (!incident) return { kind: "not-found" };

    // Refresh the projected node fields (status / category) if they changed.
    if (rest.status !== undefined || rest.category !== undefined) {
      await syncGraph(`upsertIncident(${incident.id})`, () =>
        graphRepository.upsertIncident({
          id: incident.id,
          category: incident.category,
          status: incident.status,
        }),
      );
    }

    return { kind: "ok", incident };
  };
};
