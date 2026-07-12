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

// Lists the user's active sessions, one row per session family. `currentHash` is
// the sha256 of the caller's own refresh cookie (or null), used to flag which
// session is "this device". The returned `id` is the session family id so that
// revoking survives token rotation (the token id changes on every refresh).
export const listSessionsUseCase = (refreshTokenRepo: IRefreshTokenRepository) => {
  return async (userId: string, currentHash: string | null): Promise<SessionView[]> => {
    const active = await refreshTokenRepo.findActiveByUserId(userId);
    // Collapse a family to a single row (a rotation can momentarily leave two
    // active tokens). findActiveByUserId is sorted newest-first, so the first
    // token seen per family is the one to keep.
    const byFamily = new Map<string, SessionView>();
    for (const s of active) {
      const key = s.sessionId ?? s.id;
      const view: SessionView = {
        id: key,
        userAgent: s.userAgent ?? null,
        ip: s.ip ?? null,
        createdAt: s.createdAt,
        lastUsedAt: s.lastUsedAt ?? null,
        expiresAt: s.expiresAt,
        current: currentHash !== null && s.tokenHash === currentHash,
      };
      const existing = byFamily.get(key);
      if (!existing) byFamily.set(key, view);
      else if (view.current) existing.current = true; // don't lose the current flag on the kept row
    }
    return [...byFamily.values()];
  };
};
