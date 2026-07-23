import type {
  CreateListingDto,
  ListingQueryInput,
  ListingResponseDto,
  ListingResponseDtoSchema,
  PaginatedResponseDto,
  UpdateListingDto,
} from "@repo/contracts";
import api from "./api";

/**
 * Service client des annonces (listings) : CRUD complet. La propriété (owner) et le
 * périmètre d'écriture sont appliqués côté serveur par le middleware `authorize`.
 */
type PaginatedListings = PaginatedResponseDto<typeof ListingResponseDtoSchema>;

// GET /listings — liste paginée avec filtres optionnels (recherche, type, statut, tag, …).
export async function getListings(filters: ListingQueryInput = {}): Promise<PaginatedListings> {
  const res = await api.get<PaginatedListings>("/listings", { params: filters });
  return res.data;
}

// GET /listings/:id — récupère une annonce unique.
export async function getListingById(id: string): Promise<ListingResponseDto> {
  const res = await api.get<ListingResponseDto>(`/listings/${id}`);
  return res.data;
}

// POST /listings — crée une annonce (authorId + districtId proviennent du contexte d'auth).
export async function createListing(data: CreateListingDto): Promise<ListingResponseDto> {
  const res = await api.post<ListingResponseDto>("/listings", data);
  return res.data;
}

// PATCH /listings/:id — mise à jour partielle (propriétaire uniquement, imposé par `authorize` côté backend).
export async function updateListing(id: string, data: UpdateListingDto): Promise<ListingResponseDto> {
  const res = await api.patch<ListingResponseDto>(`/listings/${id}`, data);
  return res.data;
}

// DELETE /listings/:id — suppression (propriétaire uniquement, imposé par `authorize` côté backend).
export async function deleteListing(id: string): Promise<void> {
  await api.delete(`/listings/${id}`);
}
