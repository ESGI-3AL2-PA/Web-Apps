// Client HTTP axios de l'admin-front vers l'api. Centralise l'injection du token d'acces
// (header Bearer), le rafraichissement proactif avant expiration, le retry sur 401 apres
// refresh, et le flux de step-up TOTP pour les operations sensibles (production uniquement).
import axios from "axios";
import { isTokenExpiringSoon } from "@repo/hooks";
import { config } from "@repo/config";

const AUTH_SERVICE_URL = config.authServiceUrl;
const API_BASE_URL = config.apiUrl;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Accesseurs injectes depuis l'AuthProvider : lecture du token courant + fonction de refresh.
let getAccessToken: (() => string | null) | null = null;
let refreshFn: (() => Promise<string | null>) | null = null;

/**
 * Branche le client sur la source du token d'acces et sa fonction de refresh.
 * Appele une fois par l'AuthProvider au montage.
 */
export function setupInterceptors(tokenGetter: () => string | null, refresher: () => Promise<string | null>) {
  getAccessToken = tokenGetter;
  refreshFn = refresher;
}

// Demande un nouveau code TOTP et resout vers un token de step-up (ou null si annulation).
// Enregistre par StepUpProvider ; utilise seulement en production, ou l'api repond aux
// operations sensibles par un 401 { code: "step_up_required" }.
let stepUpHandler: (() => Promise<string | null>) | null = null;

/** Enregistre (ou retire) le handler qui reclame un code TOTP pour le step-up. */
export function setStepUpHandler(handler: (() => Promise<string | null>) | null) {
  stepUpHandler = handler;
}

// Rafraichit le token de facon proactive avant expiration, puis attache le header Bearer.
// refreshPromise deduplique les refresh concurrents (une seule requete de refresh a la fois).
let refreshPromise: Promise<string | null> | null = null;

api.interceptors.request.use(async (config) => {
  const token = getAccessToken?.();

  // Si le token expire dans moins de 60s, on le rafraichit avant d'emettre la requete.
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

// Sur 401, on tente un refresh et on rejoue la requete une seule fois.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    // Operation sensible qui exige un step-up TOTP frais (production uniquement). Le token
    // d'acces est toujours valide — on reclame un code et on rejoue une fois avec l'en-tete
    // X-Step-Up-Token, pas un refresh. Le flag _stepUpRetry evite une boucle infinie.
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

    // 401 classique (token invalide/expire) : un seul retry apres refresh, garde par _retry.
    if (error.response?.status === 401 && !original._retry && refreshFn) {
      original._retry = true;
      const newToken = await refreshFn();
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
      // Le refresh a echoue — redirection vers la page de login en conservant l'URL de retour.
      window.location.href = `${AUTH_SERVICE_URL}/login?redirect_uri=${encodeURIComponent(window.location.href)}`;
    }
    return Promise.reject(error);
  },
);

export default api;
