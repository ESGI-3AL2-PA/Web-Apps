/**
 * Service client de gestion des sessions actives (lister, révoquer une session, révoquer les
 * autres). Les sessions vivent sur l'auth-service, pas sur l'api : ces appels contournent donc
 * le client axios `api` et frappent directement l'auth-service avec un token Bearer.
 */
import { config } from "@repo/config";
import type { SessionResponseDto } from "@repo/contracts";

const AUTH = config.authServiceUrl;

/**
 * Helper fetch vers l'auth-service. `credentials: "include"` envoie le cookie de refresh, ce
 * qui permet au backend de repérer quelle session est la session courante et respecte la
 * politique CORS `credentials`. Lève une erreur sur toute réponse non-2xx.
 */
async function authFetch(path: string, token: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${AUTH}${path}`, {
    ...init,
    credentials: "include",
    headers: { ...init?.headers, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res;
}

/** GET /auth/sessions — liste les sessions actives de l'utilisateur. */
export async function getSessions(token: string): Promise<SessionResponseDto[]> {
  const res = await authFetch("/auth/sessions", token);
  return res.json();
}

/** POST /auth/sessions/:id/revoke — révoque une session précise. */
export async function revokeSession(token: string, id: string): Promise<void> {
  await authFetch(`/auth/sessions/${id}/revoke`, token, { method: "POST" });
}

/** POST /auth/sessions/revoke-others — révoque toutes les sessions sauf la session courante. */
export async function revokeOtherSessions(token: string): Promise<void> {
  await authFetch("/auth/sessions/revoke-others", token, { method: "POST" });
}
