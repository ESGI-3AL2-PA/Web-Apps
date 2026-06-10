import type { AuthToken, AuthTokenType } from "../../entities/auth-token.entity.js";

export interface IAuthTokenRepository {
  create(data: Omit<AuthToken, "id">): Promise<AuthToken>;
  findActiveByHash(tokenHash: string, type: AuthTokenType): Promise<AuthToken | null>;
  markUsed(id: string): Promise<void>;
  revokeAllForUser(userId: string, type: AuthTokenType): Promise<void>;
}
