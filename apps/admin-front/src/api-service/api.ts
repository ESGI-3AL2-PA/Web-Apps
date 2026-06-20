import axios from "axios";
import { isTokenExpiringSoon } from "@repo/hooks";
import { config } from "@repo/config";

// Same shape as user-front/api-service/api.ts — interceptors handle:
//   1. Proactive refresh when the access token is < 60 s from expiring.
//   2. Reactive refresh + single retry on a 401.
// The admin app talks to the same REST API; the JWT carries an admin role
// which the backend uses to widen filters (e.g. `GET /listings` returns all).
const AUTH_SERVICE_URL = config.authServiceUrl;
const API_BASE_URL = config.apiUrl;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

let getAccessToken: (() => string | null) | null = null;
let refreshFn: (() => Promise<string | null>) | null = null;

export function setupInterceptors(
  tokenGetter: () => string | null,
  refresher: () => Promise<string | null>,
) {
  getAccessToken = tokenGetter;
  refreshFn = refresher;
}

let refreshPromise: Promise<string | null> | null = null;

api.interceptors.request.use(async (cfg) => {
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
    cfg.headers.Authorization = `Bearer ${currentToken}`;
  }
  return cfg;
});

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
      // Refresh failed — bounce to auth-service login
      window.location.href = `${AUTH_SERVICE_URL}/login?redirect_uri=${encodeURIComponent(window.location.href)}`;
    }
    return Promise.reject(error);
  },
);

export default api;
