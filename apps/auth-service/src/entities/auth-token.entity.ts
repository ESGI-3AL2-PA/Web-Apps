export type AuthTokenType = "verify_email" | "reset_password";

export interface AuthToken {
  id: string;
  userId: string;
  tokenHash: string;
  type: AuthTokenType;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
}
