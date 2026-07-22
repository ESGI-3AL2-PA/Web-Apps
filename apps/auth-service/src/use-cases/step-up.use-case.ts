import { SignJWT } from "jose";
import { TOKEN_ALG, TOKEN_ISSUER, TOKEN_AUDIENCE_STEP_UP, type StepUpClaims } from "@repo/shared";
import type { IUserReaderRepository } from "../repositories/User/user-reader.repository.js";
import { getKeyId, getPrivateKey } from "../keys.js";
import { verifyTotpStep } from "../services/totp.js";

export type StepUpResult = { kind: "ok"; stepUpToken: string } | { kind: "not-enabled" } | { kind: "invalid-code" };

/** Lifetime of a step-up token: long enough to complete one operation, short enough to be near-single-use. */
const STEP_UP_TTL = "5m";

/**
 * Verifies a fresh TOTP code for an already-authenticated user and mints a short-lived
 * step-up token authorizing one sensitive operation. Signed with the same key as the
 * access token so the api can validate it through the same JWKS (audience "step-up").
 */
export const stepUpUseCase = (userReader: IUserReaderRepository) => {
  return async (userId: string, code: string): Promise<StepUpResult> => {
    const user = await userReader.findById(userId);
    if (!user || !user.totpEnabled || !user.totpSecret) return { kind: "not-enabled" };

    const step = verifyTotpStep(code, user.totpSecret);
    if (step === null) return { kind: "invalid-code" };
    // Consume the step so the same code can't be replayed within its window.
    if (!(await userReader.consumeTotpStep(userId, step))) return { kind: "invalid-code" };

    const authTime = Math.floor(Date.now() / 1000);
    const stepUpToken = await new SignJWT({ amr: ["otp"], auth_time: authTime } satisfies StepUpClaims)
      .setProtectedHeader({ alg: TOKEN_ALG, kid: getKeyId() })
      .setSubject(userId)
      .setIssuer(TOKEN_ISSUER)
      .setAudience(TOKEN_AUDIENCE_STEP_UP)
      .setIssuedAt()
      .setExpirationTime(STEP_UP_TTL)
      .sign(getPrivateKey());

    return { kind: "ok", stepUpToken };
  };
};
