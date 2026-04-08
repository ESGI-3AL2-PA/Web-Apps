import axios from "axios";
import { type ListingResponseDto } from "../type/annonce"

const api = axios.create({
    baseURL: "http://localhost:3000",
    timeout: 10000,
});

export async function getAllAnnonces(): Promise<ListingResponseDto[]> {
    try {
        const res = await api.get<{ data: ListingResponseDto[] }>("/listings");

        const annonceResponse = res.data;

        if (!annonceResponse || !annonceResponse.data || !Array.isArray(annonceResponse.data)) {
            throw Error();
        }

        return annonceResponse.data;
    } catch (error) {
        console.error("Erreur API:", error);
        throw new Error("Erreur lors de du get all annonces")
    }

}