import { randomBytes, createHash } from "crypto";
import type { IRefreshTokenRepository } from "../repositories/RefreshToken/refresh-token.repository.js";
import type { IUserReaderRepository } from "../repositories/User/user-reader.repository.js";
import type { IDistrictAdminReaderRepository } from "../repositories/DistrictAdmin/district-admin-reader.repository.js";
import { lookupAdminDistrictId, signAccessToken } from "./issue-tokens.js";

interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

export const refreshUseCase = (
  refreshTokenRepo: IRefreshTokenRepository,
  userReader: IUserReaderRepository,
  districtAdminReader: IDistrictAdminReaderRepository,
) => {
  return async (rawRefreshToken: string): Promise<RefreshResult | null> => {
    const tokenHash = createHash("sha256").update(rawRefreshToken).digest("hex");

    // Atomically claim (revoke) the active token so two concurrent refreshes can't
    // both pass the check and mint tokens — the compare-and-swap lets exactly one win.
    const stored = await refreshTokenRepo.claimByTokenHash(tokenHash);
    if (!stored) {
      // The token isn't active. If it once existed (now revoked), this is a replay
      // of an already-rotated token → treat as theft and revoke that session's
      // family only. Scoping to the family (not the whole user) keeps the user's
      // other devices logged in — revoking everything would let one stale token on
      // one device cascade into logging the account out everywhere.
      const seen = await refreshTokenRepo.findByTokenHash(tokenHash);
      if (seen) {
        if (seen.sessionId) await refreshTokenRepo.revokeBySessionId(seen.sessionId);
        else await refreshTokenRepo.revokeAllForUser(seen.userId);
      }
      return null;
    }

    // Check expiry — the claim already revoked it, so no extra revoke needed here.
    if (new Date(stored.expiresAt) < new Date()) {
      return null;
    }

    // Look up user for fresh claims — incl. a re-read of the district-admin
    // relationship, so promotion/demotion takes effect on the next refresh.
    const user = await userReader.findById(stored.userId);
    if (!user) return null;

    // A banned user's sessions are dead: revoke the whole family and refuse to mint a new token
    // (the caller clears cookies and returns 401), completing the block started at the api layer.
    if (user.banned) {
      await refreshTokenRepo.revokeAllForUser(user.id);
      return null;
    }

    const adminDistrictId = await lookupAdminDistrictId(user, districtAdminReader);
    const accessToken = await signAccessToken(user, adminDistrictId);

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
      // Preserve the session's identity/origin across rotation; only lastUsedAt moves.
      createdAt: stored.createdAt,
      sessionId: stored.sessionId,
      userAgent: stored.userAgent,
      ip: stored.ip,
      lastUsedAt: now.toISOString(),
    });

    return { accessToken, refreshToken: newRawRefreshToken };
  };
};
