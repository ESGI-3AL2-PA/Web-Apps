import { config } from "@repo/config";
import type { StepUpResponseDto } from "@repo/contracts";

/**
 * Récupère un « step-up token » de courte durée auprès de l'auth-service.
 *
 * Le step-up est géré par l'auth-service (qui détient le secret TOTP), pas par l'api : on
 * l'appelle donc en direct avec un Bearer token. On échange un code TOTP frais à 6 chiffres
 * contre un token éphémère qui autorise une seule opération sensible.
 *
 * @param accessToken access token courant (en-tête Authorization).
 * @param code code TOTP à 6 chiffres saisi par l'admin.
 * @returns le step-up token à joindre à l'opération sensible (X-Step-Up-Token).
 * @throws Error si l'auth-service refuse (message serveur ou code HTTP).
 */
export async function fetchStepUpToken(accessToken: string, code: string): Promise<string> {
  const res = await fetch(`${config.authServiceUrl}/auth/step-up`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? `Step-up failed: ${res.status}`);
  }
  const body = (await res.json()) as StepUpResponseDto;
  return body.step_up_token;
}
