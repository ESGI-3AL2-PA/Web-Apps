import type { IIncidentRepository } from "../../repositories/Incident/incident.repository.js";

/**
 * Cas d'usage : lister les signalements avec filtres et pagination.
 *
 * Passe-plat vers le repository. Tous les parametres sont optionnels :
 * recherche plein texte, statut, categorie, quartier, auteur, assignataire,
 * ainsi que `page`/`limit` pour la pagination.
 */
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
