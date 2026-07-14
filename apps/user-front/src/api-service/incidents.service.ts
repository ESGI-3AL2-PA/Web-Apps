import type {
  CreateIncidentDto,
  IncidentQueryInput,
  IncidentResponseDto,
  IncidentResponseDtoSchema,
  PaginatedResponseDto,
} from "@repo/contracts";
import api from "./api";

type PaginatedIncidents = PaginatedResponseDto<typeof IncidentResponseDtoSchema>;

// GET /incidents — a regular user only sees their own (backend scopes by role).
export async function getIncidents(filters: IncidentQueryInput = {}): Promise<PaginatedIncidents> {
  const res = await api.get<PaginatedIncidents>("/incidents", { params: filters });
  return res.data;
}

// GET /incidents/:id — reporter or admin.
export async function getIncidentById(id: string): Promise<IncidentResponseDto> {
  const res = await api.get<IncidentResponseDto>(`/incidents/${id}`);
  return res.data;
}

// POST /incidents — report a new incident.
export async function createIncident(data: CreateIncidentDto): Promise<IncidentResponseDto> {
  const res = await api.post<IncidentResponseDto>("/incidents", data);
  return res.data;
}
