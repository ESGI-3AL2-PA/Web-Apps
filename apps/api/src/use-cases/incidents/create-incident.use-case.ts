import type { CreateIncidentDto } from "@repo/contracts";
import type { Incident } from "../../entities/incident.entity.js";
import type { IIncidentRepository } from "../../repositories/Incident/incident.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";

/**
 * Cas d'usage : creer un signalement.
 *
 * Cree le signalement en statut « open », avec une premiere entree d'historique
 * horodatee attribuee a l'auteur, puis miroite le tout dans le graphe (noeud +
 * arete auteur + arete quartier). Le miroir graphe est best-effort via syncGraph.
 *
 * @param data DTO de creation etendu de l'`reporterId` (l'auteur du signalement).
 * @returns le signalement cree.
 */
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

    // Miroir dans le graphe : noeud + aretes auteur et quartier.
    await syncGraph(`upsertIncident(${incident.id})`, () =>
      graphRepository.upsertIncident({
        id: incident.id,
        category: incident.category,
        status: incident.status,
      }),
    );
    // Arete auteur uniquement si un reporterId est present (defense contre les signalements anonymes).
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
