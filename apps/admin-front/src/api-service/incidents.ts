import type { IncidentResponseDto, IncidentStatsDto, UpdateIncidentDto } from "@repo/contracts";
import api from "./api";
import type { ListParams, Paginated } from "./types";

export async function listIncidents(params: ListParams): Promise<Paginated<IncidentResponseDto>> {
  const res = await api.get<Paginated<IncidentResponseDto>>("/incidents", { params });
  return res.data;
}

export async function getIncidentStats(): Promise<IncidentStatsDto> {
  const res = await api.get<IncidentStatsDto>("/incidents/stats");
  return res.data;
}

export async function updateIncident(id: string, body: UpdateIncidentDto): Promise<IncidentResponseDto> {
  const res = await api.patch<IncidentResponseDto>(`/incidents/${id}`, body);
  return res.data;
}

export async function deleteIncident(id: string): Promise<void> {
  await api.delete(`/incidents/${id}`);
}
