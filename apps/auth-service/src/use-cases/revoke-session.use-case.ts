import type { IRefreshTokenRepository } from "../repositories/RefreshToken/refresh-token.repository.js";

/**
 * Cas d'usage : révocation d'une session propre à l'utilisateur, par son id de
 * famille (sessionId).
 *
 * Le repository restreint la mise à jour à `userId` : c'est la garde contre l'IDOR
 * (un utilisateur ne peut pas révoquer la session d'un autre).
 *
 * @returns Une fonction renvoyant `false` si aucune session active correspondante
 *   n'existe pour cet utilisateur, `true` sinon.
 */
export const revokeSessionUseCase = (refreshTokenRepo: IRefreshTokenRepository) => {
  return (userId: string, sessionId: string): Promise<boolean> => refreshTokenRepo.revokeBySessionId(sessionId, userId);
};
