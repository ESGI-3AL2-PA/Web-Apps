import type { DistrictResponseDto } from "@repo/contracts";
import api from "./api";

// GET /districts/:id — any authenticated user; used to resolve a district name.
export async function getDistrictById(id: string): Promise<DistrictResponseDto> {
  const res = await api.get<DistrictResponseDto>(`/districts/${id}`);
  return res.data;
}
