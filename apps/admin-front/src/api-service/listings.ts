import type { ListingResponseDto } from "@repo/contracts";
import api from "./api";
import type { ListParams, Paginated } from "./types";

export async function listListings(params: ListParams): Promise<Paginated<ListingResponseDto>> {
  const res = await api.get<Paginated<ListingResponseDto>>("/listings", { params });
  return res.data;
}

export async function getListing(id: string): Promise<ListingResponseDto> {
  const res = await api.get<ListingResponseDto>(`/listings/${id}`);
  return res.data;
}

export async function deleteListing(id: string): Promise<void> {
  await api.delete(`/listings/${id}`);
}
