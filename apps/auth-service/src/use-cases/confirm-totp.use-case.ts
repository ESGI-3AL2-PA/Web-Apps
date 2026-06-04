import type { IUserReaderRepository } from "../repositories/User/user-reader.repository.js";
import { verifyTotpStep } from "../services/totp.js";

export type ConfirmTotpResult = "ok" | "user-not-found" | "no-enrollment" | "invalid-code";

export const confirmTotpUseCase = (userReader: IUserReaderRepository) => {
  return async (userId: string, code: string): Promise<ConfirmTotpResult> => {
    const user = await userReader.findById(userId);
    if (!user) return "user-not-found";
    if (!user.totpSecret) return "no-enrollment";

    const step = verifyTotpStep(code, user.totpSecret);
    if (step === null) return "invalid-code";
    // Consume the step so the same enrollment code can't be replayed.
    if (!(await userReader.consumeTotpStep(userId, step))) return "invalid-code";

    await userReader.setTotpSecret(userId, user.totpSecret, true);
    return "ok";
  };
};
