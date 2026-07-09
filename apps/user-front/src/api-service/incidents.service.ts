import type {
  CreateIncidentDto,
  IncidentQueryDto,
  IncidentResponseDto,
  IncidentResponseDtoSchema,
  PaginatedResponseDto,
} from "@repo/contracts";
import api from "./api";

type PaginatedIncidents = PaginatedResponseDto<typeof IncidentResponseDtoSchema>;

// GET /incidents — paginated list (filters: status, severity, districtId, reporterId, …)
// (Backend filtre selon le rôle ; un user lambda ne voit que ses incidents.)
export async function getIncidents(filters: IncidentQueryDto = {} as IncidentQueryDto): Promise<PaginatedIncidents> {
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

// GET /incidents/:id — reporter or admin (`authorize` middleware)
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

// POST /incidents — l'user signale un nouvel incident
export async function createIncident(data: CreateIncidentDto): Promise<IncidentResponseDto> {
  try {
    const res = await api.post<IncidentResponseDto>("/incidents", data);
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Erreur lors du signalement de l'incident");
  }
}
