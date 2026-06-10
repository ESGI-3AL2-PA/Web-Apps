import { createHash } from "crypto";
import type { IRefreshTokenRepository } from "../repositories/RefreshToken/refresh-token.repository.js";

export const logoutUseCase = (refreshTokenRepo: IRefreshTokenRepository) => {
  return async (rawRefreshToken: string): Promise<{ success: boolean }> => {
    const tokenHash = createHash("sha256").update(rawRefreshToken).digest("hex");
    await refreshTokenRepo.revokeByTokenHash(tokenHash);
    return { success: true };
  };
};
