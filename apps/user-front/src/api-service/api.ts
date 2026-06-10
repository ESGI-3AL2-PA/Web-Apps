import axios from "axios";
import { isTokenExpiringSoon } from "@repo/hooks";
import { config } from "@repo/config";
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

const AUTH_SERVICE_URL = config.authServiceUrl;
const API_BASE_URL = config.apiUrl;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

export async function getActiveListingsCount(): Promise<number> {
  const res = await api.get<{ count: number }>("/listings/count/active");
  return res.data.count;
}

let getAccessToken: (() => string | null) | null = null;
let refreshFn: (() => Promise<string | null>) | null = null;

export function setupInterceptors(tokenGetter: () => string | null, refresher: () => Promise<string | null>) {
  getAccessToken = tokenGetter;
  refreshFn = refresher;
}

// Proactively refresh token before it expires, then attach Bearer header
let refreshPromise: Promise<string | null> | null = null;

api.interceptors.request.use(async (config) => {
  const token = getAccessToken?.();

  if (token && isTokenExpiringSoon(token, 60) && refreshFn) {
    if (!refreshPromise) {
      refreshPromise = refreshFn().finally(() => {
        refreshPromise = null;
      });
    }
    await refreshPromise;
  }

  const currentToken = getAccessToken?.();
  if (currentToken) {
    config.headers.Authorization = `Bearer ${currentToken}`;
  }
  return config;
});

// On 401, attempt refresh and retry once
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry && refreshFn) {
      original._retry = true;
      const newToken = await refreshFn();
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
      // Refresh failed — redirect to login
      window.location.href = `${AUTH_SERVICE_URL}/login?redirect_uri=${encodeURIComponent(window.location.href)}`;
    }
    return Promise.reject(error);
  },
);

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

export default api;
