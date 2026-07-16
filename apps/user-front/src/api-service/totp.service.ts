import { config } from "@repo/config";
import type { TotpEnrollResponseDto } from "@repo/contracts";

// TOTP/MFA lives on the auth-service, not the api — hit it directly with a Bearer token
// (mirrors sessions.service). credentials:"include" matches the CORS credentials policy.
const AUTH = config.authServiceUrl;

async function authFetch(path: string, token: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${AUTH}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? `Request failed: ${res.status}`);
  }
  return res;
}

export async function enrollTotp(token: string): Promise<TotpEnrollResponseDto> {
  const res = await authFetch("/auth/totp/enroll", token, { method: "POST" });
  return res.json();
}

export async function confirmTotp(token: string, code: string): Promise<void> {
  await authFetch("/auth/totp/confirm", token, { method: "POST", body: JSON.stringify({ code }) });
}

export async function disableTotp(token: string, password: string): Promise<void> {
  await authFetch("/auth/totp/disable", token, { method: "POST", body: JSON.stringify({ password }) });
}
