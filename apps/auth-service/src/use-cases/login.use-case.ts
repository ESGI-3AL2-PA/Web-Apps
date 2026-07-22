import argon2 from "argon2";
import { SignJWT } from "jose";
import { TOKEN_AUDIENCE_ENROLL } from "@repo/shared";
import type { IUserReaderRepository } from "../repositories/User/user-reader.repository.js";
import type { IRefreshTokenRepository } from "../repositories/RefreshToken/refresh-token.repository.js";
import type { IDistrictAdminReaderRepository } from "../repositories/DistrictAdmin/district-admin-reader.repository.js";
import { getKeyId, getPrivateKey } from "../keys.js";
import { issueTokensForUser, type IssuedTokens, type SessionContext } from "./issue-tokens.js";

export type LoginResult =
  | ({ kind: "ok" } & IssuedTokens)
  | { kind: "invalid-credentials" }
  | { kind: "banned" }
  | { kind: "email-not-verified" }
  | { kind: "mfa-required"; mfaToken: string }
  | { kind: "enrollment-required"; enrollToken: string };

// Cached argon2 hash of a throwaway value — verified against when the email is
// unknown so login takes the same time whether or not the account exists
// (defeats timing-based user enumeration).
let dummyHash: string | null = null;
const getDummyHash = async () => (dummyHash ??= await argon2.hash("timing-equalizer"));

export const loginUseCase = (
  userReader: IUserReaderRepository,
  refreshTokenRepo: IRefreshTokenRepository,
  districtAdminReader: IDistrictAdminReaderRepository,
) => {
  return async (data: { email: string; password: string }, context?: SessionContext): Promise<LoginResult> => {
    const user = await userReader.findByEmail(data.email);
    if (!user) {
      await argon2.verify(await getDummyHash(), data.password).catch(() => false);
      return { kind: "invalid-credentials" };
    }

    const valid = await argon2.verify(user.passwordHash, data.password);
    if (!valid) return { kind: "invalid-credentials" };

    if (user.banned) return { kind: "banned" };

    if (!user.emailVerified) return { kind: "email-not-verified" };

    // Already-enrolled users are challenged for their TOTP code (opt-in or mandatory alike).
    if (user.totpEnabled) {
      // Issue a short-lived MFA token; client must POST it + a TOTP code to /auth/login/mfa.
      const mfaToken = await new SignJWT({})
        .setProtectedHeader({ alg: "RS256", kid: getKeyId() })
        .setSubject(user.id)
        .setIssuer("auth-service")
        .setAudience("mfa")
        .setIssuedAt()
        .setExpirationTime("5m")
        .sign(getPrivateKey());
      return { kind: "mfa-required", mfaToken };
    }

    // In production MFA is mandatory: a user without TOTP must enroll before any tokens are
    // issued. We hand back a short-lived `enroll` ticket that drives /auth/login/enroll/*.
    // In dev this branch is skipped, so TOTP stays fully opt-in locally.
    if (process.env.NODE_ENV === "production") {
      const enrollToken = await new SignJWT({})
        .setProtectedHeader({ alg: "RS256", kid: getKeyId() })
        .setSubject(user.id)
        .setIssuer("auth-service")
        .setAudience(TOKEN_AUDIENCE_ENROLL)
        .setIssuedAt()
        .setExpirationTime("10m")
        .sign(getPrivateKey());
      return { kind: "enrollment-required", enrollToken };
    }

    const tokens = await issueTokensForUser(user, refreshTokenRepo, districtAdminReader, context);
    return { kind: "ok", ...tokens };
  };
};
