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

// GET /listings — paginated list with optional filters (search, type, status, …)
export async function getListings(
  filters: ListingQueryDto = {} as ListingQueryDto,
): Promise<PaginatedListings> {
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
export async function getListingById(_id: string): Promise<ListingResponseDto> {
  throw new Error("Not implemented");
}

// GET /listings/author/:id — every listing published by a given author
export async function getListingsByAuthorId(id: string): Promise<ListingResponseDto[]> {
  try {
    const res = await api.get<ListingResponseDto[]>(`/listings/author/${id}`);
    if (!res) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Aucunes donnée trouvées");
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

// PATCH /listings/:id — partial update
export async function updateListing(_id: string, _data: UpdateListingDto): Promise<ListingResponseDto> {
  throw new Error("Not implemented");
}

// DELETE /listings/:id
export async function deleteListing(_id: string): Promise<void> {
  throw new Error("Not implemented");
}
