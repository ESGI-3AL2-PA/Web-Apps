import argon2 from "argon2";
import { SignJWT } from "jose";
import type { IUserReaderRepository } from "../repositories/User/user-reader.repository.js";
import type { IRefreshTokenRepository } from "../repositories/RefreshToken/refresh-token.repository.js";
import type { IDistrictAdminReaderRepository } from "../repositories/DistrictAdmin/district-admin-reader.repository.js";
import { getPrivateKey } from "../keys.js";
import { skipEmailVerification, skipTotp } from "../dev-auth.js";
import { issueTokensForUser, type IssuedTokens } from "./issue-tokens.js";

export type LoginResult =
  | ({ kind: "ok" } & IssuedTokens)
  | { kind: "invalid-credentials" }
  | { kind: "banned" }
  | { kind: "email-not-verified" }
  | { kind: "mfa-required"; mfaToken: string };

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
  return async (data: { email: string; password: string }): Promise<LoginResult> => {
    const user = await userReader.findByEmail(data.email);
    if (!user) {
      await argon2.verify(await getDummyHash(), data.password).catch(() => false);
      return { kind: "invalid-credentials" };
    }

    const valid = await argon2.verify(user.passwordHash, data.password);
    if (!valid) return { kind: "invalid-credentials" };

    if (user.banned) return { kind: "banned" };

    if (!user.emailVerified && !skipEmailVerification()) return { kind: "email-not-verified" };

    if (user.totpEnabled && !skipTotp()) {
      // Issue a short-lived MFA token; client must POST it + a TOTP code to /auth/login/mfa.
      const mfaToken = await new SignJWT({})
        .setProtectedHeader({ alg: "RS256", kid: "auth-1" })
        .setSubject(user.id)
        .setIssuer("auth-service")
        .setAudience("mfa")
        .setIssuedAt()
        .setExpirationTime("5m")
        .sign(getPrivateKey());
      return { kind: "mfa-required", mfaToken };
    }

    const tokens = await issueTokensForUser(user, refreshTokenRepo, districtAdminReader);
    return { kind: "ok", ...tokens };
  };
};
