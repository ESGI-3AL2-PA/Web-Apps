/**
 * Cas d'usage : réinitialisation de mot de passe via token.
 *
 * Couche use-case de l'auth-service. Valide un token de reset (recherché par son
 * hash sha256, à usage unique), réécrit le mot de passe hashé en argon2, brûle le
 * token, puis révoque toutes les sessions actives pour déconnecter les autres
 * appareils.
 */
import { createHash } from "crypto";
import argon2 from "argon2";
import type { IAuthTokenRepository } from "../repositories/AuthToken/auth-token.repository.js";
import type { IUserReaderRepository } from "../repositories/User/user-reader.repository.js";
import type { IRefreshTokenRepository } from "../repositories/RefreshToken/refresh-token.repository.js";

export type ResetPasswordResult = "ok" | "invalid" | "expired" | "user-not-found";

/**
 * Factory du cas d'usage de réinitialisation de mot de passe.
 *
 * @returns Une fonction prenant le token brut et le nouveau mot de passe. Renvoie
 *   `"invalid"` (token inconnu/déjà utilisé), `"expired"` (token périmé, alors
 *   marqué utilisé), `"user-not-found"` (compte supprimé) ou `"ok"`.
 */
export const resetPasswordUseCase = (
  authTokenRepo: IAuthTokenRepository,
  userReader: IUserReaderRepository,
  refreshTokenRepo: IRefreshTokenRepository,
) => {
  return async (rawToken: string, newPassword: string): Promise<ResetPasswordResult> => {
    // Recherche le token par son hash sha256, restreint au type reset_password.
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const record = await authTokenRepo.findActiveByHash(tokenHash, "reset_password");
    if (!record) return "invalid";

    if (new Date(record.expiresAt) < new Date()) {
      // Même expiré, on marque la ligne utilisée pour empêcher toute nouvelle tentative.
      await authTokenRepo.markUsed(record.id);
      return "expired";
    }

    const user = await userReader.findById(record.userId);
    if (!user) return "user-not-found";

    const passwordHash = await argon2.hash(newPassword);
    await userReader.setPasswordHash(user.id, passwordHash);
    await authTokenRepo.markUsed(record.id);

    // Révoque tous les refresh tokens actifs pour déconnecter les autres sessions.
    await refreshTokenRepo.revokeAllForUser(user.id);

    return "ok";
  };
};
