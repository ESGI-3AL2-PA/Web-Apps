import type { IRefreshTokenRepository } from "../repositories/RefreshToken/refresh-token.repository.js";

export interface SessionView {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string;
  current: boolean;
}

// Lists the user's active sessions. `currentHash` is the sha256 of the caller's
// own refresh cookie (or null), used to flag which session is "this device".
export const listSessionsUseCase = (refreshTokenRepo: IRefreshTokenRepository) => {
  return async (userId: string, currentHash: string | null): Promise<SessionView[]> => {
    const active = await refreshTokenRepo.findActiveByUserId(userId);
    return active.map((s) => ({
      id: s.id,
      userAgent: s.userAgent ?? null,
      ip: s.ip ?? null,
      createdAt: s.createdAt,
      lastUsedAt: s.lastUsedAt ?? null,
      expiresAt: s.expiresAt,
      current: currentHash !== null && s.tokenHash === currentHash,
    }));
  };
};
