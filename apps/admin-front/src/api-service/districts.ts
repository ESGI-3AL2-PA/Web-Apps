import type { CreateDistrictDto, DistrictResponseDto, UpdateDistrictDto } from "@repo/contracts";
import api from "./api";
import type { ListParams, Paginated } from "./types";

export async function listDistricts(params: ListParams): Promise<Paginated<DistrictResponseDto>> {
  const res = await api.get<Paginated<DistrictResponseDto>>("/districts", { params });
  return res.data;
}

export async function getDistrict(id: string): Promise<DistrictResponseDto> {
  const res = await api.get<DistrictResponseDto>(`/districts/${id}`);
  return res.data;
}

export async function createDistrict(body: CreateDistrictDto): Promise<DistrictResponseDto> {
  const res = await api.post<DistrictResponseDto>("/districts", body);
  return res.data;
}

export async function updateDistrict(id: string, body: UpdateDistrictDto): Promise<DistrictResponseDto> {
  const res = await api.patch<DistrictResponseDto>(`/districts/${id}`, body);
  return res.data;
}

export async function deleteDistrict(id: string): Promise<void> {
  await api.delete(`/districts/${id}`);
}
