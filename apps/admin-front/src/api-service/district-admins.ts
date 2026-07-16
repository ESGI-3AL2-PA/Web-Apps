import type { CreateDistrictAdminDto, DistrictAdminResponseDto } from "@repo/contracts";
import api from "./api";
import type { ListParams, Paginated } from "./types";

export async function listDistrictAdmins(params: ListParams): Promise<Paginated<DistrictAdminResponseDto>> {
  const res = await api.get<Paginated<DistrictAdminResponseDto>>("/district-admins", { params });
  return res.data;
}

export async function createDistrictAdmin(body: CreateDistrictAdminDto): Promise<DistrictAdminResponseDto> {
  const res = await api.post<DistrictAdminResponseDto>("/district-admins", body);
  return res.data;
}

export async function deleteDistrictAdmin(id: string): Promise<void> {
  await api.delete(`/district-admins/${id}`);
}
