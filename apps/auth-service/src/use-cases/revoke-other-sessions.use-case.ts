import type { IRefreshTokenRepository } from "../repositories/RefreshToken/refresh-token.repository.js";

/**
 * Cas d'usage : « se déconnecter partout ailleurs ».
 *
 * Révoque toutes les familles de sessions actives sauf celle de l'appelant (la
 * famille dont le token courant correspond à `currentHash`). Si le hash courant
 * est inconnu (`null`), révoque tout.
 *
 * @returns Une fonction prenant l'userId et le hash du token courant.
 */
export const revokeOtherSessionsUseCase = (refreshTokenRepo: IRefreshTokenRepository) => {
  return async (userId: string, currentHash: string | null): Promise<void> => {
    const active = await refreshTokenRepo.findActiveByUserId(userId);
    // Identifie la famille (session) à préserver via le hash du token courant.
    const currentSessionId = active.find((s) => currentHash !== null && s.tokenHash === currentHash)?.sessionId ?? null;
    // Familles à révoquer : toutes celles distinctes de la session courante.
    const otherFamilies = new Set(
      active
        .filter((s) => currentHash === null || s.tokenHash !== currentHash)
        .map((s) => s.sessionId)
        .filter((id): id is string => id !== null && id !== currentSessionId),
    );
    await Promise.all([...otherFamilies].map((sessionId) => refreshTokenRepo.revokeBySessionId(sessionId, userId)));
    // Anciens tokens sans identifiant de famille : révoqués un par un (impossible
    // de les regrouper par session).
    await Promise.all(
      active
        .filter((s) => s.sessionId === null && (currentHash === null || s.tokenHash !== currentHash))
        .map((s) => refreshTokenRepo.revokeById(s.id, userId)),
    );
  };
};
