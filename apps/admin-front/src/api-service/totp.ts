// Couche api-service : gestion TOTP/MFA (enrôlement, confirmation, désactivation).
import { config } from "@repo/config";
import type { TotpEnrollResponseDto } from "@repo/contracts";

// Le TOTP/MFA est géré par l'auth-service, pas par l'api — on l'appelle en direct avec un Bearer token.
const AUTH = config.authServiceUrl;

/**
 * Levée quand l'auth-service exige un step-up (ex. désactivation du TOTP en production).
 * Porte le discriminateur `code` pour que l'appelant puisse demander un code TOTP et
 * réessayer en joignant un en-tête X-Step-Up-Token.
 */
export class StepUpRequiredError extends Error {
  code = "step_up_required" as const;
}

/**
 * Fetch interne vers l'auth-service avec Bearer token et cookies (refresh).
 * Traduit les erreurs HTTP en Error, et le cas 401 `step_up_required` en StepUpRequiredError.
 */
async function authFetch(path: string, token: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${AUTH}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string; code?: string };
    // Cas particulier : l'auth-service réclame une vérification renforcée avant de poursuivre.
    if (res.status === 401 && body.code === "step_up_required") {
      throw new StepUpRequiredError(body.message ?? "Step-up verification required");
    }
    throw new Error(body.message ?? `Request failed: ${res.status}`);
  }
  return res;
}

/** POST /auth/totp/enroll — démarre l'enrôlement TOTP (renvoie secret + otpauth URI pour le QR code). */
export async function enrollTotp(token: string): Promise<TotpEnrollResponseDto> {
  const res = await authFetch("/auth/totp/enroll", token, { method: "POST" });
  return res.json();
}

/** POST /auth/totp/confirm — confirme l'enrôlement en validant un premier code à 6 chiffres. */
export async function confirmTotp(token: string, code: string): Promise<void> {
  await authFetch("/auth/totp/confirm", token, { method: "POST", body: JSON.stringify({ code }) });
}

/**
 * POST /auth/totp/disable — désactive le TOTP. Nécessite le mot de passe ; en production
 * l'auth-service peut exiger un step-up, joint ici via l'en-tête X-Step-Up-Token si fourni.
 */
export async function disableTotp(token: string, password: string, stepUpToken?: string): Promise<void> {
  await authFetch("/auth/totp/disable", token, {
    method: "POST",
    headers: stepUpToken ? { "X-Step-Up-Token": stepUpToken } : undefined,
    body: JSON.stringify({ password }),
  });
}
