import type { IAuthTokenRepository } from "../repositories/AuthToken/auth-token.repository.js";
import type { IUserReaderRepository } from "../repositories/User/user-reader.repository.js";
import { sendVerificationEmailUseCase } from "./send-verification-email.use-case.js";

// Always succeeds silently (no user enumeration). If user exists and is unverified,
// sends a fresh verification email; otherwise no-op.
export const resendVerificationUseCase = (userReader: IUserReaderRepository, authTokenRepo: IAuthTokenRepository) => {
  return async (email: string): Promise<void> => {
    const user = await userReader.findByEmail(email);
    if (!user || user.emailVerified) return;
    await sendVerificationEmailUseCase(authTokenRepo)(user.id, user.email, user.lang);
  };
};
