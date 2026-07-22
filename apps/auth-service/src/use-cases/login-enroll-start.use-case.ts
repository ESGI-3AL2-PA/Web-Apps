import { jwtVerify } from "jose";
import { TOKEN_ISSUER, TOKEN_AUDIENCE_ENROLL } from "@repo/shared";
import type { IUserReaderRepository } from "../repositories/User/user-reader.repository.js";
import { getPublicKey } from "../keys.js";
import { enrollTotpUseCase } from "./enroll-totp.use-case.js";

export type LoginEnrollStartResult =
  | { kind: "ok"; otpauthUrl: string; secret: string }
  | { kind: "invalid-token" }
  | { kind: "already-enabled" };

/**
 * Mandatory-enrollment ceremony (step 1). Verifies the short-lived `enroll` ticket
 * minted by the login use-case and generates a TOTP secret — without ever needing the
 * `aud:"api"` access token the user cannot yet obtain (they have no confirmed factor).
 */
export const loginEnrollStartUseCase = (userReader: IUserReaderRepository) => {
  const enroll = enrollTotpUseCase(userReader);
  return async (enrollToken: string): Promise<LoginEnrollStartResult> => {
    let userId: string;
    try {
      const { payload } = await jwtVerify(enrollToken, getPublicKey(), {
        algorithms: ["RS256"],
        issuer: TOKEN_ISSUER,
        audience: TOKEN_AUDIENCE_ENROLL,
      });
      if (!payload.sub) return { kind: "invalid-token" };
      userId = payload.sub;
    } catch {
      return { kind: "invalid-token" };
    }

    const result = await enroll(userId);
    if (result.kind === "ok") return { kind: "ok", otpauthUrl: result.otpauthUrl, secret: result.secret };
    if (result.kind === "already-enabled") return { kind: "already-enabled" };
    return { kind: "invalid-token" };
  };
};
