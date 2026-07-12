import type { RefreshToken } from "../../entities/refresh-token.entity.js";

export interface IRefreshTokenRepository {
  create(data: Omit<RefreshToken, "id">): Promise<RefreshToken>;
  findActiveByTokenHash(tokenHash: string): Promise<RefreshToken | null>;
  // Lookup regardless of revoked status — used to detect reuse of a rotated token.
  findByTokenHash(tokenHash: string): Promise<RefreshToken | null>;
  // Active (non-revoked, non-expired) sessions for the "active sessions" view.
  findActiveByUserId(userId: string): Promise<RefreshToken[]>;
  revokeByTokenHash(tokenHash: string): Promise<boolean>;
  // Revoke one session by id, scoped to its owner. Returns false if not found/not theirs.
  revokeById(id: string, userId: string): Promise<boolean>;
  revokeAllForUser(userId: string): Promise<void>;
}
