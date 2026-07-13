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
  const res = await api.get<PaginatedListings>("/listings", { params: filters });
  return res.data;
}

// GET /listings/:id — fetch a single listing
export async function getListingById(id: string): Promise<ListingResponseDto> {
  const res = await api.get<ListingResponseDto>(`/listings/${id}`);
  return res.data;
}

// POST /listings — create a new listing (authorId + districtId come from auth context)
export async function createListing(data: CreateListingDto): Promise<ListingResponseDto> {
  const res = await api.post<ListingResponseDto>("/listings", data);
  return res.data;
}

// PATCH /listings/:id — partial update (owner only, enforced by backend `authorize`)
export async function updateListing(id: string, data: UpdateListingDto): Promise<ListingResponseDto> {
  const res = await api.patch<ListingResponseDto>(`/listings/${id}`, data);
  return res.data;
}

// DELETE /listings/:id (owner only, enforced by backend `authorize`)
export async function deleteListing(id: string): Promise<void> {
  await api.delete(`/listings/${id}`);
}
