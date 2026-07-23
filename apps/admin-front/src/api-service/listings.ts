// Couche api-service : wrappers axios autour des endpoints annonces (« listings ») de l'api.
import type { ListingResponseDto } from "@repo/contracts";
import api from "./api";
import type { ListParams, Paginated } from "./types";

/** GET /listings — liste paginée des annonces. */
export async function listListings(params: ListParams): Promise<Paginated<ListingResponseDto>> {
  const res = await api.get<Paginated<ListingResponseDto>>("/listings", { params });
  return res.data;
}

/** GET /listings/:id — détail d'une annonce. */
export async function getListing(id: string): Promise<ListingResponseDto> {
  const res = await api.get<ListingResponseDto>(`/listings/${id}`);
  return res.data;
}

/** DELETE /listings/:id — supprime une annonce (modération). */
export async function deleteListing(id: string): Promise<void> {
  await api.delete(`/listings/${id}`);
}
