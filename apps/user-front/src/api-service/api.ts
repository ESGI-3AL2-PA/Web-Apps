/**
 * Client axios partagé par tous les services de l'user-front (le fichier expose
 * l'instance `api` par défaut). Il porte deux intercepteurs :
 *  - requête : rafraîchit le token de manière proactive avant expiration puis attache
 *    l'en-tête `Authorization: Bearer`.
 *  - réponse : sur 401, tente un refresh + un retry unique, et gère le step-up TOTP.
 *
 * Les accesseurs de token (`setupInterceptors`) et le handler de step-up
 * (`setStepUpHandler`) sont injectés depuis les providers React à l'initialisation,
 * ce qui évite un couplage direct entre ce module et le contexte d'auth.
 */
import axios from "axios";
import { isTokenExpiringSoon } from "@repo/hooks";
import { config } from "@repo/config";

const API_BASE_URL = config.apiUrl;
const AUTH_SERVICE_URL = config.authServiceUrl;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

// Callbacks injectés par AuthProvider : lecture du access token courant et fonction de refresh.
let getAccessToken: (() => string | null) | null = null;
let refreshFn: (() => Promise<string | null>) | null = null;

/**
 * Enregistre les accesseurs d'auth utilisés par les intercepteurs.
 * @param tokenGetter renvoie le access token courant (ou null si déconnecté).
 * @param refresher rafraîchit le token et renvoie le nouveau (ou null en cas d'échec).
 */
export function setupInterceptors(tokenGetter: () => string | null, refresher: () => Promise<string | null>) {
  getAccessToken = tokenGetter;
  refreshFn = refresher;
}

// Demande à l'utilisateur un nouveau code TOTP et résout vers un token de step-up (ou null
// s'il annule / en cas d'échec). Enregistré par StepUpProvider ; utilisé uniquement en
// production, où l'api répond aux opérations sensibles par 401 { code: "step_up_required" }.
let stepUpHandler: (() => Promise<string | null>) | null = null;

/** Enregistre (ou retire, avec null) le handler qui obtient un token de step-up. */
export function setStepUpHandler(handler: (() => Promise<string | null>) | null) {
  stepUpHandler = handler;
}

// Promesse de refresh partagée : garantit qu'un seul refresh est en vol même si plusieurs
// requêtes concurrentes constatent en même temps que le token va bientôt expirer.
let refreshPromise: Promise<string | null> | null = null;

api.interceptors.request.use(async (config) => {
  const token = getAccessToken?.();

  // Refresh proactif : si le token expire dans moins de 60 s, on le renouvelle avant d'envoyer.
  if (token && isTokenExpiringSoon(token, 60) && refreshFn) {
    if (!refreshPromise) {
      refreshPromise = refreshFn().finally(() => {
        refreshPromise = null;
      });
    }
    await refreshPromise;
  }

  // On relit le token après un éventuel refresh avant de poser l'en-tête Bearer.
  const currentToken = getAccessToken?.();
  if (currentToken) {
    config.headers.Authorization = `Bearer ${currentToken}`;
  }
  return config;
});

// Sur 401, tente un refresh puis rejoue la requête une seule fois.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    // Une opération sensible exige un step-up TOTP frais (production uniquement). Le access
    // token est toujours valide : ce n'est donc PAS un cas de refresh. On demande un code, puis
    // on rejoue une fois avec le token de step-up émis dans l'en-tête X-Step-Up-Token.
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
      // Le refresh a échoué — on redirige vers la page de login en conservant l'URL de retour.
      window.location.href = `${AUTH_SERVICE_URL}/login?redirect_uri=${encodeURIComponent(window.location.href)}`;
    }
    return Promise.reject(error);
  },
);

export default api;
