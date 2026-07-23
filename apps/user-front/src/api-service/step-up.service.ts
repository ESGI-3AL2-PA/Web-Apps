/**
 * Service client du step-up TOTP. Le step-up vit sur l'auth-service (qui détient le secret
 * TOTP) : on le frappe directement avec un token Bearer, à l'image de totp.service. Échange un
 * code à 6 chiffres frais contre un token de step-up éphémère autorisant une seule opération
 * sensible (voir l'intercepteur de réponse dans api.ts).
 */
import { config } from "@repo/config";
import type { StepUpResponseDto } from "@repo/contracts";

/**
 * POST /auth/step-up — échange un code TOTP contre un token de step-up.
 * @param accessToken access token courant, posé en Bearer.
 * @param code code TOTP à 6 chiffres saisi par l'utilisateur.
 * @returns le `step_up_token` à placer dans l'en-tête X-Step-Up-Token du retry.
 * @throws Error avec le message serveur (ou le statut HTTP) si l'échange échoue.
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
