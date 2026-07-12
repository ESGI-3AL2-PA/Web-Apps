import type { IRefreshTokenRepository } from "../repositories/RefreshToken/refresh-token.repository.js";

// Revoke every active session except the caller's own (matched by refresh-token
// hash). "Log out everywhere else." If the current hash is unknown, revoke all.
export const revokeOtherSessionsUseCase = (refreshTokenRepo: IRefreshTokenRepository) => {
  return async (userId: string, currentHash: string | null): Promise<void> => {
    const active = await refreshTokenRepo.findActiveByUserId(userId);
    await Promise.all(
      active
        .filter((s) => currentHash === null || s.tokenHash !== currentHash)
        .map((s) => refreshTokenRepo.revokeById(s.id, userId)),
    );
  };
};
