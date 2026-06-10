import { authenticator } from "otplib";
import type { IUserReaderRepository } from "../repositories/User/user-reader.repository.js";

const ISSUER_LABEL = process.env.TOTP_ISSUER ?? "Web-Apps";

export type EnrollTotpResult =
  | { kind: "ok"; otpauthUrl: string; secret: string }
  | { kind: "user-not-found" }
  | { kind: "already-enabled" };

// Generates a fresh TOTP secret and stores it with enabled=false. The user must
// then confirm a code from their authenticator to flip enabled=true.
export const enrollTotpUseCase = (userReader: IUserReaderRepository) => {
  return async (userId: string): Promise<EnrollTotpResult> => {
    const user = await userReader.findById(userId);
    if (!user) return { kind: "user-not-found" };
    if (user.totpEnabled) return { kind: "already-enabled" };

    const secret = authenticator.generateSecret();
    await userReader.setTotpSecret(userId, secret, false);

    const otpauthUrl = authenticator.keyuri(user.email, ISSUER_LABEL, secret);
    return { kind: "ok", otpauthUrl, secret };
  };
};
