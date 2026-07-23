// Cas d'usage : déconnexion. Révoque le refresh token présenté (celui de l'appareil courant).
import { createHash } from "crypto";
import type { IRefreshTokenRepository } from "../repositories/RefreshToken/refresh-token.repository.js";

/** Révoque le refresh token courant par son empreinte sha256 ; toujours idempotent (succès même si déjà révoqué/absent). */
export const logoutUseCase = (refreshTokenRepo: IRefreshTokenRepository) => {
  return async (rawRefreshToken: string): Promise<{ success: boolean }> => {
    // On ne stocke que l'empreinte sha256 en base : on la recalcule pour retrouver la ligne à révoquer.
    const tokenHash = createHash("sha256").update(rawRefreshToken).digest("hex");
    await refreshTokenRepo.revokeByTokenHash(tokenHash);
    return { success: true };
  };
};
