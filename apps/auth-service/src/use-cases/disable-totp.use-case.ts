import argon2 from "argon2";
import type { IUserReaderRepository } from "../repositories/User/user-reader.repository.js";

export type DisableTotpResult = "ok" | "user-not-found" | "wrong-password";

// Requires password confirmation so an attacker with a stolen access token
// alone can't downgrade the account's security.
export const disableTotpUseCase = (userReader: IUserReaderRepository) => {
  return async (userId: string, password: string): Promise<DisableTotpResult> => {
    const user = await userReader.findById(userId);
    if (!user) return "user-not-found";

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) return "wrong-password";

    await userReader.setTotpSecret(userId, null, false);
    return "ok";
  };
};
