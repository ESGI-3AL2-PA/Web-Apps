import type { DistrictResponseDto } from "@repo/contracts";
import api from "./api";

// GET /districts/:id — accessible à tout user authentifié (audience: api, pas de scope).
export async function getDistrictById(id: string): Promise<DistrictResponseDto> {
  try {
    const res = await api.get<DistrictResponseDto>(`/districts/${id}`);
    if (!res.data) throw new Error();
    return res.data;
  } catch {
    throw new Error("Quartier introuvable");
  }
}
