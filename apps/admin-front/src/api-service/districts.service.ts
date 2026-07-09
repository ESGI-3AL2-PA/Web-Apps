import type {
  CreateDistrictDto,
  DistrictQueryDto,
  DistrictResponseDto,
  DistrictResponseDtoSchema,
  PaginatedResponseDto,
  UpdateDistrictDto,
} from "@repo/contracts";
import api from "./api";

type PaginatedDistricts = PaginatedResponseDto<typeof DistrictResponseDtoSchema>;

// Consigne ADMIN — DISTRICTS: full CRUD (gestion géographique du quartier)

// GET /districts — paginated list with optional search
export async function getDistricts(filters: DistrictQueryDto = {} as DistrictQueryDto): Promise<PaginatedDistricts> {
  try {
    const res = await api.get<PaginatedDistricts>("/districts", { params: filters });
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Erreur lors du get all districts");
  }
}

// GET /districts/:id — single district + geoJson polygon
export async function getDistrictById(id: string): Promise<DistrictResponseDto> {
  try {
    const res = await api.get<DistrictResponseDto>(`/districts/${id}`);
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Quartier introuvable");
  }
}

// POST /districts — create a new district
export async function createDistrict(data: CreateDistrictDto): Promise<DistrictResponseDto> {
  try {
    const res = await api.post<DistrictResponseDto>("/districts", data);
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Erreur lors de la création du quartier");
  }
}

// PATCH /districts/:id — partial update (name, geoJson, …)
export async function updateDistrict(id: string, data: UpdateDistrictDto): Promise<DistrictResponseDto> {
  try {
    const res = await api.patch<DistrictResponseDto>(`/districts/${id}`, data);
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Erreur lors de la mise à jour du quartier");
  }
}

// DELETE /districts/:id
export async function deleteDistrict(id: string): Promise<void> {
  try {
    await api.delete(`/districts/${id}`);
  } catch {
    throw new Error("Erreur lors de la suppression du quartier");
  }
}
