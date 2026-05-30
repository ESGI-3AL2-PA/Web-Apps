import axios from "axios";
import { type ListingResponseDto } from "../type/annonce";

type PaginatedListingsResponse = {
  data: ListingResponseDto[];
  total: number;
  page: number;
  limit: number;
};

const api = axios.create({
  baseURL: "http://localhost:3000",
  timeout: 10000,
});

export async function getAllAnnonces(): Promise<ListingResponseDto[]> {
  try {
    const res = await api.get<PaginatedListingsResponse>("/listings");

    if (!res.data) {
      throw Error();
    }

    return res.data.data;
  } catch (error) {
    throw new Error("Erreur lors de du get all annonces");
  }
}
