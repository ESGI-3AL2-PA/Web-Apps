import type { IIncidentRepository } from "../../repositories/Incident/incident.repository.js";

/**
 * Cas d'usage : recuperer un signalement par identifiant.
 * Passe-plat vers le repository ; renvoie null si introuvable.
 */
export const getIncidentByIdUseCase = (incidentRepository: IIncidentRepository) => {
  return async (params: { id: string }) => {
    return await incidentRepository.getIncidentById(params.id);
  };
};
