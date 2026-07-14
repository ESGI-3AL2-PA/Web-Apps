import { jwtVerify } from "jose";
import type { IUserReaderRepository } from "../repositories/User/user-reader.repository.js";
import type { IRefreshTokenRepository } from "../repositories/RefreshToken/refresh-token.repository.js";
import type { IDistrictAdminReaderRepository } from "../repositories/DistrictAdmin/district-admin-reader.repository.js";
import { getPublicKey } from "../keys.js";
import { verifyTotpStep } from "../services/totp.js";
import { issueTokensForUser, type IssuedTokens, type SessionContext } from "./issue-tokens.js";

export type LoginMfaResult =
  | ({ kind: "ok" } & IssuedTokens)
  | { kind: "invalid-mfa-token" }
  | { kind: "invalid-code" }
  | { kind: "user-not-found" }
  | { kind: "totp-not-enabled" };

export const loginMfaUseCase = (
  userReader: IUserReaderRepository,
  refreshTokenRepo: IRefreshTokenRepository,
  districtAdminReader: IDistrictAdminReaderRepository,
) => {
  return async (mfaToken: string, code: string, context?: SessionContext): Promise<LoginMfaResult> => {
    let userId: string;
    try {
      const { payload } = await jwtVerify(mfaToken, getPublicKey(), {
        algorithms: ["RS256"],
        issuer: "auth-service",
        audience: "mfa",
      });
      if (!payload.sub) return { kind: "invalid-mfa-token" };
      userId = payload.sub;
    } catch {
      return { kind: "invalid-mfa-token" };
    }

    const user = await userReader.findById(userId);
    if (!user) return { kind: "user-not-found" };
    if (!user.totpEnabled || !user.totpSecret) return { kind: "totp-not-enabled" };

    const step = verifyTotpStep(code, user.totpSecret);
    if (step === null) return { kind: "invalid-code" };
    // Reject a code already consumed within its window (replay).
    if (!(await userReader.consumeTotpStep(userId, step))) return { kind: "invalid-code" };

    const tokens = await issueTokensForUser(user, refreshTokenRepo, districtAdminReader, context);
    return { kind: "ok", ...tokens };
  };
};
