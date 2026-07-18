import { initServer } from "@ts-rest/express";
import { incidentsContract } from "@repo/contracts";
import { resolve } from "../../repositories/container.js";
import { resolveListDistrictScope } from "../../middleware/district-scope.js";
import { getIncidentsUseCase } from "../../use-cases/incidents/get-incidents.use-case.js";
import { getIncidentByIdUseCase } from "../../use-cases/incidents/get-incident-by-id.use-case.js";
import { createIncidentUseCase } from "../../use-cases/incidents/create-incident.use-case.js";
import { updateIncidentUseCase } from "../../use-cases/incidents/update-incident.use-case.js";
import { deleteIncidentUseCase } from "../../use-cases/incidents/delete-incident.use-case.js";
import { getIncidentStatsUseCase } from "../../use-cases/incidents/get-incident-stats.use-case.js";

const s = initServer();

export const incidentsRouter = s.router(incidentsContract, {
  getIncidents: async ({ query, req }) => {
    // Un résident ne voit que les signalements QU'IL a ouverts — pas ceux de son quartier.
    // On force reporterId (au lieu de le fusionner) pour que la valeur envoyée par le
    // client ne puisse jamais l'emporter, et on neutralise les autres filtres de portée.
    const isAdmin = req.user!.role === "admin" || req.user!.role === "superAdmin";
    if (!isAdmin) {
      const result = await getIncidentsUseCase(resolve("incident"))({
        ...query,
        reporterId: req.user!.sub,
        assignedTo: undefined,
        districtId: undefined,
      });
      return { status: 200, body: result };
    }
    const scope = resolveListDistrictScope(req.user!, query.districtId);
    if ("empty" in scope) {
      return { status: 200, body: { data: [], total: 0, page: query.page, limit: query.limit } };
    }
    const result = await getIncidentsUseCase(resolve("incident"))({ ...query, districtId: scope.districtId });
    return { status: 200, body: result };
  },

  getIncidentStats: async ({ query, req }) => {
    const isAdmin = req.user!.role === "admin" || req.user!.role === "superAdmin";
    if (!isAdmin) {
      const stats = await getIncidentStatsUseCase(resolve("incident"))({ reporterId: req.user!.sub });
      return { status: 200, body: stats };
    }
    const scope = resolveListDistrictScope(req.user!, query.districtId);
    if ("empty" in scope) {
      return { status: 200, body: { total: 0, byStatus: {}, byCategory: {} } };
    }
    const stats = await getIncidentStatsUseCase(resolve("incident"))({ districtId: scope.districtId });
    return { status: 200, body: stats };
  },

  getIncidentById: async ({ params: { id } }) => {
    // Reporter/admin visibility is enforced by the contract-metadata middleware.
    const incident = await getIncidentByIdUseCase(resolve("incident"))({ id });
    if (!incident) {
      return { status: 404, body: { message: "Incident not found" } };
    }
    return { status: 200, body: incident };
  },

  createIncident: async ({ body, req }) => {
    const newIncident = await createIncidentUseCase(
      resolve("incident"),
      resolve("graph"),
    )({
      ...body,
      reporterId: req.user!.sub,
    });
    return { status: 201, body: newIncident };
  },

  updateIncident: async ({ params: { id }, body, req }) => {
    // Reporter/admin authorization is enforced by the contract-metadata middleware.
    const result = await updateIncidentUseCase(resolve("incident"), resolve("user"), resolve("graph"))(
      id,
      body,
      req.user!.sub,
    );
    if (result.kind === "not-found") {
      return { status: 404, body: { message: "Incident not found" } };
    }
    if (result.kind === "invalid-assignee") {
      return { status: 400, body: { message: "An incident can only be assigned to an admin" } };
    }
    return { status: 200, body: result.incident };
  },

  deleteIncident: async ({ params: { id } }) => {
    const deleted = await deleteIncidentUseCase(resolve("incident"), resolve("graph"))({ id });
    if (!deleted) {
      return { status: 404, body: { message: "Incident not found" } };
    }
    return { status: 204, body: undefined };
  },
});
