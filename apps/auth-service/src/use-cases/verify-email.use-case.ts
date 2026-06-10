import { createHash } from "crypto";
import type { IAuthTokenRepository } from "../repositories/AuthToken/auth-token.repository.js";
import type { IUserReaderRepository } from "../repositories/User/user-reader.repository.js";

export type VerifyEmailResult = "ok" | "invalid" | "expired" | "user-not-found";

export const verifyEmailUseCase = (authTokenRepo: IAuthTokenRepository, userReader: IUserReaderRepository) => {
  return async (rawToken: string): Promise<VerifyEmailResult> => {
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const record = await authTokenRepo.findActiveByHash(tokenHash, "verify_email");
    if (!record) return "invalid";

    if (new Date(record.expiresAt) < new Date()) {
      await authTokenRepo.markUsed(record.id);
      return "expired";
    }

    const user = await userReader.findById(record.userId);
    if (!user) return "user-not-found";

    await userReader.setEmailVerified(record.userId);
    await authTokenRepo.markUsed(record.id);
    return "ok";
  };
};
