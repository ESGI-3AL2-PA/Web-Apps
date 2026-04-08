import axios from "axios";
import { type ListingResponseDto } from "../type/annonce"

const api = axios.create({
    baseURL: "http://localhost:3000",
    timeout: 10000,
});

export async function getAllAnnonces(): Promise<ListingResponseDto[]> {
    try {
        const res = await api.get<ListingResponseDto[]>("/listings");

        if (!res) {
            throw Error();
        }

        return res.data;
    } catch (error) {
        throw new Error("Erreur lors de du get all annonces")
    }

}