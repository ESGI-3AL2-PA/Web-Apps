// Service de gestion du TOTP/MFA (enrôlement, confirmation, désactivation).
// Le TOTP est géré par l'auth-service, PAS par l'api : ce module tape donc
// directement l'auth-service avec un access token en Bearer (même approche que
// sessions.service), au lieu de passer par le client axios `api`.
import { config } from "@repo/config";
import type { TotpEnrollResponseDto } from "@repo/contracts";

// URL de base de l'auth-service. `credentials:"include"` envoie le cookie de refresh
// et correspond à la politique CORS d'auth-service (credentials autorisés).
const AUTH = config.authServiceUrl;

/**
 * Erreur levée quand l'auth-service exige une ré-authentification (step-up) —
 * cas de la désactivation du TOTP en production. Le champ `code` porte le
 * discriminant `step_up_required` : l'appelant peut ainsi demander un code à
 * l'utilisateur et réessayer avec un en-tête `X-Step-Up-Token`.
 */
export class StepUpRequiredError extends Error {
  code = "step_up_required" as const;
}

/**
 * Wrapper `fetch` vers l'auth-service : injecte le Bearer token et le Content-Type,
 * inclut les credentials, et traduit les réponses non-2xx en exceptions.
 * Un 401 assorti du code `step_up_required` est converti en `StepUpRequiredError`.
 */
async function authFetch(path: string, token: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${AUTH}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string; code?: string };
    if (res.status === 401 && body.code === "step_up_required") {
      throw new StepUpRequiredError(body.message ?? "Step-up verification required");
    }
    throw new Error(body.message ?? `Request failed: ${res.status}`);
  }
  return res;
}

/** POST /auth/totp/enroll — démarre l'enrôlement, renvoie le secret + l'URI otpauth (QR code). */
export async function enrollTotp(token: string): Promise<TotpEnrollResponseDto> {
  const res = await authFetch("/auth/totp/enroll", token, { method: "POST" });
  return res.json();
}

/** POST /auth/totp/confirm — valide l'enrôlement en vérifiant un premier code à 6 chiffres. */
export async function confirmTotp(token: string, code: string): Promise<void> {
  await authFetch("/auth/totp/confirm", token, { method: "POST", body: JSON.stringify({ code }) });
}

/**
 * POST /auth/totp/disable — désactive le TOTP. Exige le mot de passe. En production
 * un step-up peut être requis : passer alors `stepUpToken` (en-tête `X-Step-Up-Token`).
 */
export async function disableTotp(token: string, password: string, stepUpToken?: string): Promise<void> {
  await authFetch("/auth/totp/disable", token, {
    method: "POST",
    headers: stepUpToken ? { "X-Step-Up-Token": stepUpToken } : undefined,
    body: JSON.stringify({ password }),
  });
}
