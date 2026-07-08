import type {
  ListingQueryDto,
  ListingResponseDto,
  ListingResponseDtoSchema,
  PaginatedResponseDto,
} from "@repo/contracts";
import api from "./api";

type PaginatedListings = PaginatedResponseDto<typeof ListingResponseDtoSchema>;

// Consigne ADMIN — LISTINGS:
//   - Read all (statistiques et modération)
//   - Delete (modération)
// (Pas de create/update — réservés à l'user-front)

// GET /listings — paginated list (admin: sans filtre authorId, voit tout)
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

// GET /listings/:id
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

// GET /listings/count/active — KPI dashboard
export async function getActiveListingsCount(): Promise<number> {
  try {
    const res = await api.get<{ count: number }>("/listings/count/active");
    return res.data.count;
  } catch {
    throw new Error("Erreur lors du chargement du compteur d'annonces actives");
  }
}

// DELETE /listings/:id — modération
export async function deleteListing(id: string): Promise<void> {
  try {
    await api.delete(`/listings/${id}`);
  } catch {
    throw new Error("Erreur lors de la suppression de l'annonce");
  }
}
