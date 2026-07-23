// Wrappers d'appels HTTP vers les endpoints /district-admins (administrateurs de quartier).
import type { CreateDistrictAdminDto, DistrictAdminResponseDto } from "@repo/contracts";
import api from "./api";
import type { ListParams, Paginated } from "./types";

/** Liste paginee des administrateurs de quartier. */
export async function listDistrictAdmins(params: ListParams): Promise<Paginated<DistrictAdminResponseDto>> {
  const res = await api.get<Paginated<DistrictAdminResponseDto>>("/district-admins", { params });
  return res.data;
}

/** Nomme un administrateur de quartier. */
export async function createDistrictAdmin(body: CreateDistrictAdminDto): Promise<DistrictAdminResponseDto> {
  const res = await api.post<DistrictAdminResponseDto>("/district-admins", body);
  return res.data;
}

/** Retire un administrateur de quartier par son id. */
export async function deleteDistrictAdmin(id: string): Promise<void> {
  await api.delete(`/district-admins/${id}`);
}
