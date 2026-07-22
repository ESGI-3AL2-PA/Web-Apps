import { jwtVerify } from "jose";
import { TOKEN_ISSUER, TOKEN_AUDIENCE_ENROLL } from "@repo/shared";
import type { IUserReaderRepository } from "../repositories/User/user-reader.repository.js";
import type { IRefreshTokenRepository } from "../repositories/RefreshToken/refresh-token.repository.js";
import type { IDistrictAdminReaderRepository } from "../repositories/DistrictAdmin/district-admin-reader.repository.js";
import { getPublicKey } from "../keys.js";
import { confirmTotpUseCase } from "./confirm-totp.use-case.js";
import { issueTokensForUser, type IssuedTokens, type SessionContext } from "./issue-tokens.js";

export type LoginEnrollConfirmResult =
  | ({ kind: "ok" } & IssuedTokens)
  | { kind: "invalid-token" }
  | { kind: "invalid-code" };

/**
 * Mandatory-enrollment ceremony (step 2). Verifies the `enroll` ticket, confirms the
 * first TOTP code (flipping totpEnabled=true), then issues the real tokens — closing
 * the loop so a freshly-enrolled user lands authenticated exactly like /auth/login/mfa.
 */
export const loginEnrollConfirmUseCase = (
  userReader: IUserReaderRepository,
  refreshTokenRepo: IRefreshTokenRepository,
  districtAdminReader: IDistrictAdminReaderRepository,
) => {
  const confirm = confirmTotpUseCase(userReader);
  return async (enrollToken: string, code: string, context?: SessionContext): Promise<LoginEnrollConfirmResult> => {
    let userId: string;
    try {
      const { payload } = await jwtVerify(enrollToken, getPublicKey(), {
        algorithms: ["RS256"],
        issuer: TOKEN_ISSUER,
        audience: TOKEN_AUDIENCE_ENROLL,
      });
      if (!payload.sub) return { kind: "invalid-token" };
      userId = payload.sub;
    } catch {
      return { kind: "invalid-token" };
    }

    const result = await confirm(userId, code);
    if (result === "invalid-code") return { kind: "invalid-code" };
    if (result !== "ok") return { kind: "invalid-token" };

    const user = await userReader.findById(userId);
    if (!user) return { kind: "invalid-token" };

    const tokens = await issueTokensForUser(user, refreshTokenRepo, districtAdminReader, context);
    return { kind: "ok", ...tokens };
  };
};
