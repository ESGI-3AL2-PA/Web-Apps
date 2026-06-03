import { randomBytes, createHash } from "crypto";
import type { IAuthTokenRepository } from "../repositories/AuthToken/auth-token.repository.js";
import { sendVerificationEmail } from "../services/email.service.js";

const AUTH_PUBLIC_URL = process.env.AUTH_PUBLIC_URL ?? "http://localhost:6000";
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24h

// Issues a verification token for the given user, persists its sha256 hash,
// and emails the raw token to the user as a link.
export const sendVerificationEmailUseCase = (authTokenRepo: IAuthTokenRepository) => {
  return async (userId: string, email: string): Promise<void> => {
    // Revoke any in-flight verification tokens for this user so only the latest works.
    await authTokenRepo.revokeAllForUser(userId, "verify_email");

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + VERIFY_TTL_MS);

    await authTokenRepo.create({
      userId,
      tokenHash,
      type: "verify_email",
      expiresAt: expiresAt.toISOString(),
      usedAt: null,
      createdAt: now.toISOString(),
    });

    const link = `${AUTH_PUBLIC_URL}/auth/verify?token=${rawToken}`;
    await sendVerificationEmail(email, link);
  };
};
