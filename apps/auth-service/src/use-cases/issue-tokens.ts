import { randomBytes, createHash } from "crypto";
import { SignJWT } from "jose";
import type { UserRecord } from "../repositories/User/user-reader.repository.js";
import type { IRefreshTokenRepository } from "../repositories/RefreshToken/refresh-token.repository.js";
import { getPrivateKey } from "../keys.js";

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  user: Omit<UserRecord, "passwordHash" | "totpSecret">;
}

// Shared by login + login-mfa: signs an access token, persists a refresh token,
// strips the password hash from the user payload.
export const issueTokensForUser = async (
  user: UserRecord,
  refreshTokenRepo: IRefreshTokenRepository,
): Promise<IssuedTokens> => {
  const accessToken = await new SignJWT({
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
  })
    .setProtectedHeader({ alg: "RS256", kid: "auth-1" })
    .setSubject(user.id)
    .setIssuer("auth-service")
    .setAudience("api")
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(getPrivateKey());

  const rawRefreshToken = randomBytes(64).toString("hex");
  const tokenHash = createHash("sha256").update(rawRefreshToken).digest("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  await refreshTokenRepo.create({
    userId: user.id,
    tokenHash,
    expiresAt: expiresAt.toISOString(),
    revokedAt: null,
    createdAt: now.toISOString(),
  });

  const { passwordHash: _passwordHash, totpSecret: _totpSecret, ...userDto } = user;
  return { accessToken, refreshToken: rawRefreshToken, user: userDto };
};
