import axios from "axios";
import { isTokenExpiringSoon } from "@repo/hooks";
import { config } from "@repo/config";

const API_BASE_URL = config.apiUrl;
const AUTH_SERVICE_URL = config.authServiceUrl;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

let getAccessToken: (() => string | null) | null = null;
let refreshFn: (() => Promise<string | null>) | null = null;

export function setupInterceptors(tokenGetter: () => string | null, refresher: () => Promise<string | null>) {
  getAccessToken = tokenGetter;
  refreshFn = refresher;
}

// Prompts the user for a fresh TOTP code and resolves to a step-up token (or null if
// they cancel / it fails). Registered by StepUpProvider; only used in production, where
// the api answers sensitive operations with 401 { code: "step_up_required" }.
let stepUpHandler: (() => Promise<string | null>) | null = null;

export function setStepUpHandler(handler: (() => Promise<string | null>) | null) {
  stepUpHandler = handler;
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

    // A sensitive operation needs a fresh TOTP step-up (production only). The access token
    // is still valid, so this is NOT a refresh case: prompt for a code, then retry once with
    // the minted step-up token in X-Step-Up-Token.
    if (
      error.response?.status === 401 &&
      error.response?.data?.code === "step_up_required" &&
      original &&
      !original._stepUpRetry &&
      stepUpHandler
    ) {
      original._stepUpRetry = true;
      const stepUpToken = await stepUpHandler();
      if (stepUpToken) {
        original.headers["X-Step-Up-Token"] = stepUpToken;
        return api(original);
      }
      return Promise.reject(error);
    }

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

export default api;
