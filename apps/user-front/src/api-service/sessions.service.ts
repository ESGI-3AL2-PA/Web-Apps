import { config } from "@repo/config";
import type { SessionResponseDto } from "@repo/contracts";

// Sessions live on the auth-service, not the api — so these bypass the axios
// `api` client and hit auth-service directly with a Bearer token. `credentials:
// "include"` lets the backend flag which session is the current one (it reads
// the refresh cookie), and matches the CORS `credentials` policy.
const AUTH = config.authServiceUrl;

async function authFetch(path: string, token: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${AUTH}${path}`, {
    ...init,
    credentials: "include",
    headers: { ...init?.headers, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res;
}

export async function getSessions(token: string): Promise<SessionResponseDto[]> {
  const res = await authFetch("/auth/sessions", token);
  return res.json();
}

export async function revokeSession(token: string, id: string): Promise<void> {
  await authFetch(`/auth/sessions/${id}/revoke`, token, { method: "POST" });
}

export async function revokeOtherSessions(token: string): Promise<void> {
  await authFetch("/auth/sessions/revoke-others", token, { method: "POST" });
}
