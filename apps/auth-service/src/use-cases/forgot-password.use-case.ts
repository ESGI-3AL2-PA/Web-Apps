import { randomBytes, createHash } from "crypto";
import type { IAuthTokenRepository } from "../repositories/AuthToken/auth-token.repository.js";
import type { IUserReaderRepository } from "../repositories/User/user-reader.repository.js";
import { sendPasswordResetEmail } from "../services/email.service.js";

const AUTH_PUBLIC_URL = process.env.AUTH_PUBLIC_URL ?? "http://localhost:3001";
const RESET_TTL_MS = 60 * 60 * 1000; // 1h

// Always silent (no user enumeration). If the email maps to a verified user,
// invalidates prior reset tokens, mints a new one, and emails the link.
export const forgotPasswordUseCase = (userReader: IUserReaderRepository, authTokenRepo: IAuthTokenRepository) => {
  return async (email: string): Promise<void> => {
    const user = await userReader.findByEmail(email);
    if (!user) return;

    await authTokenRepo.revokeAllForUser(user.id, "reset_password");

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + RESET_TTL_MS);

    await authTokenRepo.create({
      userId: user.id,
      tokenHash,
      type: "reset_password",
      expiresAt: expiresAt.toISOString(),
      usedAt: null,
      createdAt: now.toISOString(),
    });

    const link = `${AUTH_PUBLIC_URL}/reset-password?token=${rawToken}`;
    await sendPasswordResetEmail(user.email, link, user.lang);
  };
};
