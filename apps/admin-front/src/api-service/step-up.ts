import { config } from "@repo/config";
import type { StepUpResponseDto } from "@repo/contracts";

// Step-up lives on the auth-service (it holds the TOTP secret) — hit it directly with a
// Bearer token. Exchanges a fresh 6-digit code for a short-lived step-up token that
// authorizes one sensitive operation.
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
