import axios from "axios";
import { type ListingResponseDto } from "../type/annonce";

type PaginatedListingsResponse = {
  data: ListingResponseDto[];
  total: number;
  page: number;
  limit: number;
};

export type ListingType =
  | "Jardinage"
  | "Bricolage"
  | "Garde d'enfants"
  | "Cuisine"
  | "Transport"
  | "Animaux"
  | "Informatique";

export type ListingFilters = {
  search?: string;
  type?: ListingType;
  status?: "active" | "closed" | "expired";
  page?: number;
  limit?: number;
};

const api = axios.create({
  baseURL: "http://localhost:3000",
  timeout: 10000,
});

export async function getAllAnnonces(filters: ListingFilters = {}): Promise<ListingResponseDto[]> {
  try {
    const res = await api.get<PaginatedListingsResponse>("/listings", { params: filters });

    if (!res.data) {
      throw Error();
    }

    return res.data.data;
  } catch {
    throw new Error("Erreur lors du get all annonces");
  }
}
