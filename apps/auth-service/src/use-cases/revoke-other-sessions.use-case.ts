import type { IRefreshTokenRepository } from "../repositories/RefreshToken/refresh-token.repository.js";

// Revoke every active session family except the caller's own (the family whose
// current token matches `currentHash`). "Log out everywhere else." If the current
// hash is unknown, revoke all.
export const revokeOtherSessionsUseCase = (refreshTokenRepo: IRefreshTokenRepository) => {
  return async (userId: string, currentHash: string | null): Promise<void> => {
    const active = await refreshTokenRepo.findActiveByUserId(userId);
    const currentSessionId = active.find((s) => currentHash !== null && s.tokenHash === currentHash)?.sessionId ?? null;
    const otherFamilies = new Set(
      active
        .filter((s) => currentHash === null || s.tokenHash !== currentHash)
        .map((s) => s.sessionId)
        .filter((id): id is string => id !== null && id !== currentSessionId),
    );
    await Promise.all([...otherFamilies].map((sessionId) => refreshTokenRepo.revokeBySessionId(sessionId, userId)));
    // Old tokens without a family id: revoke individually (can't group them).
    await Promise.all(
      active
        .filter((s) => s.sessionId === null && (currentHash === null || s.tokenHash !== currentHash))
        .map((s) => refreshTokenRepo.revokeById(s.id, userId)),
    );
  };
};
