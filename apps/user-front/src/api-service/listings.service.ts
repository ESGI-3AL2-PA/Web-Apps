import type {
  CreateListingDto,
  ListingQueryDto,
  ListingResponseDto,
  ListingResponseDtoSchema,
  PaginatedResponseDto,
  UpdateListingDto,
} from "@repo/contracts";
import api from "./api";

type PaginatedListings = PaginatedResponseDto<typeof ListingResponseDtoSchema>;

// GET /listings — paginated list with optional filters (search, type, status, tag, …)
export async function getListings(filters: ListingQueryDto = {} as ListingQueryDto): Promise<PaginatedListings> {
  try {
    const res = await api.get<PaginatedListings>("/listings", { params: filters });
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Erreur lors du get all annonces");
  }
}

// GET /listings/:id — fetch a single listing
export async function getListingById(id: string): Promise<ListingResponseDto> {
  try {
    const res = await api.get<ListingResponseDto>(`/listings/${id}`);
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Annonce introuvable");
  }
}

// GET /listings/count/active — number of currently active listings
export async function getActiveListingsCount(): Promise<number> {
  const res = await api.get<{ count: number }>("/listings/count/active");
  return res.data.count;
}

// POST /listings — create a new listing (authorId + districtId come from auth context)
export async function createListing(data: CreateListingDto): Promise<ListingResponseDto> {
  try {
    const res = await api.post<ListingResponseDto>("/listings", data);
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Erreur lors de la création d'annonce");
  }
}

// PATCH /listings/:id — partial update (owner only, enforced by backend `authorize`)
export async function updateListing(id: string, data: UpdateListingDto): Promise<ListingResponseDto> {
  try {
    const res = await api.patch<ListingResponseDto>(`/listings/${id}`, data);
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Erreur lors de la mise à jour de l'annonce");
  }
}

// DELETE /listings/:id (owner only, enforced by backend `authorize`)
export async function deleteListing(id: string): Promise<void> {
  try {
    await api.delete(`/listings/${id}`);
  } catch {
    throw new Error("Erreur lors de la suppression de l'annonce");
  }
}
