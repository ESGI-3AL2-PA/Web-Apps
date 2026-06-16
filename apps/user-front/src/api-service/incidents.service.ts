import type {
  CreateIncidentDto,
  IncidentQueryDto,
  IncidentResponseDto,
  IncidentResponseDtoSchema,
  IncidentStatsDto,
  PaginatedResponseDto,
  UpdateIncidentDto,
} from "@repo/contracts";

type PaginatedIncidents = PaginatedResponseDto<typeof IncidentResponseDtoSchema>;

export async function getIncidents(
  _filters: IncidentQueryDto = {} as IncidentQueryDto,
): Promise<PaginatedIncidents> {
  throw new Error("Not implemented");
}

export async function getIncidentById(_id: string): Promise<IncidentResponseDto> {
  throw new Error("Not implemented");
}

export async function getIncidentStats(): Promise<IncidentStatsDto> {
  throw new Error("Not implemented");
}

export async function createIncident(_data: CreateIncidentDto): Promise<IncidentResponseDto> {
  throw new Error("Not implemented");
}

export async function updateIncident(_id: string, _data: UpdateIncidentDto): Promise<IncidentResponseDto> {
  throw new Error("Not implemented");
}

export async function deleteIncident(_id: string): Promise<void> {
  throw new Error("Not implemented");
}
