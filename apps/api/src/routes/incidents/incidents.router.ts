import { initServer } from "@ts-rest/express";
import { incidentsContract } from "@repo/contracts";
import { resolve } from "../../repositories/container.js";
import { getIncidentsUseCase } from "../../use-cases/incidents/get-incidents.use-case.js";
import { getIncidentByIdUseCase } from "../../use-cases/incidents/get-incident-by-id.use-case.js";
import { createIncidentUseCase } from "../../use-cases/incidents/create-incident.use-case.js";
import { updateIncidentUseCase } from "../../use-cases/incidents/update-incident.use-case.js";
import { deleteIncidentUseCase } from "../../use-cases/incidents/delete-incident.use-case.js";
import { getIncidentStatsUseCase } from "../../use-cases/incidents/get-incident-stats.use-case.js";

const s = initServer();

export const incidentsRouter = s.router(incidentsContract, {
  getIncidents: async ({ query }) => {
    const result = await getIncidentsUseCase(resolve("incident"))(query);
    return { status: 200, body: result };
  },

  getIncidentStats: async () => {
    const stats = await getIncidentStatsUseCase(resolve("incident"))();
    return { status: 200, body: stats };
  },

  getIncidentById: async ({ params: { id } }) => {
    const incident = await getIncidentByIdUseCase(resolve("incident"))({ id });
    if (!incident) {
      return { status: 404, body: { message: "Incident not found" } };
    }
    return { status: 200, body: incident };
  },

  createIncident: async ({ body, req }) => {
    const newIncident = await createIncidentUseCase(resolve("incident"))({
      ...body,
      reporterId: req.user!.sub,
    });
    return { status: 201, body: newIncident };
  },

  updateIncident: async ({ params: { id }, body, req }) => {
    const existing = await getIncidentByIdUseCase(resolve("incident"))({ id });
    if (!existing) {
      return { status: 404, body: { message: "Incident not found" } };
    }
    if (existing.reporterId !== req.user!.sub && req.user!.role !== "admin") {
      return { status: 403, body: { message: "Reporter or admin only" } };
    }
    const incident = await updateIncidentUseCase(resolve("incident"))(id, body, req.user!.sub);
    if (!incident) {
      return { status: 404, body: { message: "Incident not found" } };
    }
    return { status: 200, body: incident };
  },

  deleteIncident: async ({ params: { id }, req }) => {
    const existing = await getIncidentByIdUseCase(resolve("incident"))({ id });
    if (!existing) {
      return { status: 404, body: { message: "Incident not found" } };
    }
    if (existing.reporterId !== req.user!.sub && req.user!.role !== "admin") {
      return { status: 403, body: { message: "Reporter or admin only" } };
    }
    const deleted = await deleteIncidentUseCase(resolve("incident"))({ id });
    if (!deleted) {
      return { status: 404, body: { message: "Incident not found" } };
    }
    return { status: 204, body: undefined };
  },
});
