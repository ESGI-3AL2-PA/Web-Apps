import type {
  CreateIncidentDto,
  IncidentQueryInput,
  IncidentResponseDto,
  IncidentResponseDtoSchema,
  PaginatedResponseDto,
} from "@repo/contracts";
import api from "./api";

/**
 * Service client des signalements (incidents). Un utilisateur standard ne voit que les siens :
 * le périmètre est appliqué côté serveur selon son rôle.
 */
type PaginatedIncidents = PaginatedResponseDto<typeof IncidentResponseDtoSchema>;

// GET /incidents — un utilisateur standard ne voit que ses propres signalements (périmètre par rôle côté backend).
export async function getIncidents(filters: IncidentQueryInput = {}): Promise<PaginatedIncidents> {
  const res = await api.get<PaginatedIncidents>("/incidents", { params: filters });
  return res.data;
}

// GET /incidents/:id — auteur du signalement ou admin.
export async function getIncidentById(id: string): Promise<IncidentResponseDto> {
  const res = await api.get<IncidentResponseDto>(`/incidents/${id}`);
  return res.data;
}

// POST /incidents — déclare un nouveau signalement.
export async function createIncident(data: CreateIncidentDto): Promise<IncidentResponseDto> {
  const res = await api.post<IncidentResponseDto>("/incidents", data);
  return res.data;
}
