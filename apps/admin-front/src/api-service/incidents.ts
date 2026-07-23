// Couche api-service : wrappers axios autour des endpoints signalements (« incidents ») de l'api.
// Chaque fonction renvoie directement le corps de la réponse ; l'instance `api` gère baseURL,
// Bearer token et refresh via ses interceptors.
import type { IncidentResponseDto, IncidentStatsDto, UpdateIncidentDto } from "@repo/contracts";
import api from "./api";
import type { ListParams, Paginated } from "./types";

/** GET /incidents — liste paginée des signalements (filtres/pagination via `params`). */
export async function listIncidents(params: ListParams): Promise<Paginated<IncidentResponseDto>> {
  const res = await api.get<Paginated<IncidentResponseDto>>("/incidents", { params });
  return res.data;
}

/** GET /incidents/stats — agrégats (compteurs par statut, etc.), restreints à un quartier si `districtId` fourni. */
export async function getIncidentStats(districtId?: string): Promise<IncidentStatsDto> {
  const res = await api.get<IncidentStatsDto>("/incidents/stats", {
    // Filtre par quartier uniquement si demandé ; sinon on laisse l'api appliquer le scope par défaut.
    params: districtId ? { districtId } : undefined,
  });
  return res.data;
}

/** PATCH /incidents/:id — met à jour un signalement (ex. changement de statut). */
export async function updateIncident(id: string, body: UpdateIncidentDto): Promise<IncidentResponseDto> {
  const res = await api.patch<IncidentResponseDto>(`/incidents/${id}`, body);
  return res.data;
}

/** DELETE /incidents/:id — supprime un signalement. */
export async function deleteIncident(id: string): Promise<void> {
  await api.delete(`/incidents/${id}`);
}
