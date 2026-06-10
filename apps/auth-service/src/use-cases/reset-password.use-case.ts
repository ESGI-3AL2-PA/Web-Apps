import { createHash } from "crypto";
import argon2 from "argon2";
import type { IAuthTokenRepository } from "../repositories/AuthToken/auth-token.repository.js";
import type { IUserReaderRepository } from "../repositories/User/user-reader.repository.js";
import type { IRefreshTokenRepository } from "../repositories/RefreshToken/refresh-token.repository.js";

export type ResetPasswordResult = "ok" | "invalid" | "expired" | "user-not-found";

export const resetPasswordUseCase = (
  authTokenRepo: IAuthTokenRepository,
  userReader: IUserReaderRepository,
  refreshTokenRepo: IRefreshTokenRepository,
) => {
  return async (rawToken: string, newPassword: string): Promise<ResetPasswordResult> => {
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const record = await authTokenRepo.findActiveByHash(tokenHash, "reset_password");
    if (!record) return "invalid";

    if (new Date(record.expiresAt) < new Date()) {
      await authTokenRepo.markUsed(record.id);
      return "expired";
    }

    const user = await userReader.findById(record.userId);
    if (!user) return "user-not-found";

    const passwordHash = await argon2.hash(newPassword);
    await userReader.setPasswordHash(user.id, passwordHash);
    await authTokenRepo.markUsed(record.id);

    // Revoke all active refresh tokens so other sessions are logged out.
    await refreshTokenRepo.revokeAllForUser(user.id);

    return "ok";
  };
};
