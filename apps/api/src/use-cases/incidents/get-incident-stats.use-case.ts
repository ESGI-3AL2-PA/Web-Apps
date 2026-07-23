import type { IIncidentRepository } from "../../repositories/Incident/incident.repository.js";

/**
 * Cas d'usage : agreger les statistiques de signalements.
 *
 * Passe-plat vers le repository. Les filtres optionnels restreignent le calcul
 * a un quartier (`districtId`) et/ou a un auteur (`reporterId`).
 */
export const getIncidentStatsUseCase = (incidentRepository: IIncidentRepository) => {
  return async (params?: { districtId?: string; reporterId?: string }) => {
    return await incidentRepository.getStats(params);
  };
};
