import { config } from "@repo/config";
import type { TotpEnrollResponseDto } from "@repo/contracts";

// TOTP/MFA lives on the auth-service, not the api — hit it directly with a Bearer token
// (mirrors sessions.service). credentials:"include" matches the CORS credentials policy.
const AUTH = config.authServiceUrl;

// Error thrown when the auth-service demands a step-up (production disable-TOTP). Carries the
// discriminator so the caller can prompt for a code and retry with an X-Step-Up-Token.
export class StepUpRequiredError extends Error {
  code = "step_up_required" as const;
}

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

export async function enrollTotp(token: string): Promise<TotpEnrollResponseDto> {
  const res = await authFetch("/auth/totp/enroll", token, { method: "POST" });
  return res.json();
}

export async function confirmTotp(token: string, code: string): Promise<void> {
  await authFetch("/auth/totp/confirm", token, { method: "POST", body: JSON.stringify({ code }) });
}

export async function disableTotp(token: string, password: string, stepUpToken?: string): Promise<void> {
  await authFetch("/auth/totp/disable", token, {
    method: "POST",
    headers: stepUpToken ? { "X-Step-Up-Token": stepUpToken } : undefined,
    body: JSON.stringify({ password }),
  });
}
