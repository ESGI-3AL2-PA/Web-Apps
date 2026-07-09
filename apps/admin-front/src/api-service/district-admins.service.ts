import type {
  CreateDistrictAdminDto,
  DistrictAdminQueryDto,
  DistrictAdminResponseDto,
  DistrictAdminResponseDtoSchema,
  PaginatedResponseDto,
} from "@repo/contracts";
import api from "./api";

type PaginatedDistrictAdmins = PaginatedResponseDto<typeof DistrictAdminResponseDtoSchema>;

// GET /district-admins — paginated list, filtres districtId/userId
export async function getDistrictAdmins(
  filters: DistrictAdminQueryDto = {} as DistrictAdminQueryDto,
): Promise<PaginatedDistrictAdmins> {
  try {
    const res = await api.get<PaginatedDistrictAdmins>("/district-admins", { params: filters });
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Erreur lors du get all district-admins");
  }
}

// GET /district-admins/:id
export async function getDistrictAdminById(id: string): Promise<DistrictAdminResponseDto> {
  try {
    const res = await api.get<DistrictAdminResponseDto>(`/district-admins/${id}`);
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("District-admin introuvable");
  }
}

// POST /district-admins — attribuer un admin à un quartier
export async function createDistrictAdmin(data: CreateDistrictAdminDto): Promise<DistrictAdminResponseDto> {
  try {
    const res = await api.post<DistrictAdminResponseDto>("/district-admins", data);
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Erreur lors de l'attribution du rôle admin de quartier");
  }
}

// DELETE /district-admins/:id — retirer un admin
export async function deleteDistrictAdmin(id: string): Promise<void> {
  try {
    await api.delete(`/district-admins/${id}`);
  } catch {
    throw new Error("Erreur lors du retrait du rôle admin de quartier");
  }
}
