/**
 * Service client des quartiers (districts). Minimal côté user-front : seule la lecture
 * d'un quartier par son id est exposée, principalement pour afficher son nom.
 */
import type { DistrictResponseDto } from "@repo/contracts";
import api from "./api";

// GET /districts/:id — tout utilisateur authentifié ; sert à résoudre le nom d'un quartier.
export async function getDistrictById(id: string): Promise<DistrictResponseDto> {
  const res = await api.get<DistrictResponseDto>(`/districts/${id}`);
  return res.data;
}
