import type { IRefreshTokenRepository } from "../repositories/RefreshToken/refresh-token.repository.js";

// Revoke one of the user's own sessions by id. Returns false if it doesn't exist
// or belongs to someone else (the repo scopes the update to userId).
export const revokeSessionUseCase = (refreshTokenRepo: IRefreshTokenRepository) => {
  return (userId: string, sessionId: string): Promise<boolean> => refreshTokenRepo.revokeById(sessionId, userId);
};
