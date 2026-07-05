import type {
  IncidentQueryDto,
  IncidentResponseDto,
  IncidentResponseDtoSchema,
  IncidentStatsDto,
  PaginatedResponseDto,
  UpdateIncidentDto,
} from "@repo/contracts";
import api from "./api";

type PaginatedIncidents = PaginatedResponseDto<typeof IncidentResponseDtoSchema>;

// Consigne ADMIN — INCIDENTS:
//   - Read all (tous les incidents du quartier)
//   - Update (changer statut, assigner à quelqu'un)
// (Pas de create côté admin — c'est l'user qui signale)

// GET /incidents — paginated list (filters: status, severity, districtId, …)
export async function getIncidents(
  filters: IncidentQueryDto = {} as IncidentQueryDto,
): Promise<PaginatedIncidents> {
  try {
    const res = await api.get<PaginatedIncidents>("/incidents", { params: filters });
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Erreur lors du get all incidents");
  }
}

// GET /incidents/:id
export async function getIncidentById(id: string): Promise<IncidentResponseDto> {
  try {
    const res = await api.get<IncidentResponseDto>(`/incidents/${id}`);
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Incident introuvable");
  }
}

// GET /incidents/stats — KPIs pour le dashboard admin
export async function getIncidentStats(): Promise<IncidentStatsDto> {
  try {
    const res = await api.get<IncidentStatsDto>("/incidents/stats");
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Erreur lors du chargement des statistiques d'incidents");
  }
}

// PATCH /incidents/:id — change le statut, assigne un responsable
export async function updateIncident(
  id: string,
  data: UpdateIncidentDto,
): Promise<IncidentResponseDto> {
  try {
    const res = await api.patch<IncidentResponseDto>(`/incidents/${id}`, data);
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Erreur lors de la mise à jour de l'incident");
  }
}
