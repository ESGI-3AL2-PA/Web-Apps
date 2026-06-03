import { randomBytes, createHash } from "crypto";
import { SignJWT } from "jose";
import type { IRefreshTokenRepository } from "../repositories/RefreshToken/refresh-token.repository.js";
import type { IUserReaderRepository } from "../repositories/User/user-reader.repository.js";
import { getPrivateKey } from "../keys.js";

interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

export const refreshUseCase = (refreshTokenRepo: IRefreshTokenRepository, userReader: IUserReaderRepository) => {
  return async (rawRefreshToken: string): Promise<RefreshResult | null> => {
    const tokenHash = createHash("sha256").update(rawRefreshToken).digest("hex");

    const stored = await refreshTokenRepo.findActiveByTokenHash(tokenHash);
    if (!stored) {
      // The token isn't active. If it once existed (now revoked), this is a replay
      // of an already-rotated token → treat as theft and revoke the whole family.
      const seen = await refreshTokenRepo.findByTokenHash(tokenHash);
      if (seen) await refreshTokenRepo.revokeAllForUser(seen.userId);
      return null;
    }

    // Check expiry
    if (new Date(stored.expiresAt) < new Date()) {
      await refreshTokenRepo.revokeByTokenHash(tokenHash);
      return null;
    }

    // Revoke old token (rotation)
    await refreshTokenRepo.revokeByTokenHash(tokenHash);

    // Look up user for fresh claims
    const user = await userReader.findById(stored.userId);
    if (!user) return null;

    // Issue new access token
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

    // Issue new refresh token
    const newRawRefreshToken = randomBytes(64).toString("hex");
    const newTokenHash = createHash("sha256").update(newRawRefreshToken).digest("hex");

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    await refreshTokenRepo.create({
      userId: stored.userId,
      tokenHash: newTokenHash,
      expiresAt: expiresAt.toISOString(),
      revokedAt: null,
      createdAt: now.toISOString(),
    });

    return { accessToken, refreshToken: newRawRefreshToken };
  };
};
