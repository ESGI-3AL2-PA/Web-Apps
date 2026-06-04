import type { RefreshToken } from "../../entities/refresh-token.entity.js";

export interface IRefreshTokenRepository {
  create(data: Omit<RefreshToken, "id">): Promise<RefreshToken>;
  findActiveByTokenHash(tokenHash: string): Promise<RefreshToken | null>;
  // Lookup regardless of revoked status — used to detect reuse of a rotated token.
  findByTokenHash(tokenHash: string): Promise<RefreshToken | null>;
  revokeByTokenHash(tokenHash: string): Promise<boolean>;
  revokeAllForUser(userId: string): Promise<void>;
}
