import type { IRefreshTokenRepository } from "../repositories/RefreshToken/refresh-token.repository.js";

// Revoke one of the user's own sessions by its family id. Returns false if no
// such active session exists for this user (the repo scopes the update to userId).
export const revokeSessionUseCase = (refreshTokenRepo: IRefreshTokenRepository) => {
  return (userId: string, sessionId: string): Promise<boolean> => refreshTokenRepo.revokeBySessionId(sessionId, userId);
};
