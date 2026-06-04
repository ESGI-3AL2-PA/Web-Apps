import { SignJWT } from "jose";
import type { IUserReaderRepository } from "../repositories/User/user-reader.repository.js";
import type { IAuthTokenRepository } from "../repositories/AuthToken/auth-token.repository.js";
import { getPrivateKey } from "../keys.js";
import { skipEmailVerification } from "../dev-auth.js";
import { sendVerificationEmailUseCase } from "./send-verification-email.use-case.js";

const API_URL = process.env.API_URL || "http://localhost:3000";

interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  password: string;
  address: string;
}

export type RegisterResult = "ok" | "email-taken";

export const registerUseCase = (userReader: IUserReaderRepository, authTokenRepo: IAuthTokenRepository) => {
  return async (data: RegisterInput): Promise<RegisterResult> => {
    const existing = await userReader.findByEmail(data.email);
    if (existing) return "email-taken";

    // Short-lived service JWT to authenticate with the API (POST /users).
    const serviceToken = await new SignJWT({
      role: "service",
    })
      .setProtectedHeader({ alg: "RS256", kid: "auth-1" })
      .setSubject("auth-service")
      .setIssuer("auth-service")
      .setAudience("api:internal")
      .setIssuedAt()
      .setExpirationTime("30s")
      .sign(getPrivateKey());

    const apiRes = await fetch(`${API_URL}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceToken}` },
      body: JSON.stringify(data),
    });

    if (!apiRes.ok) {
      const err = (await apiRes.json().catch(() => ({}))) as { message?: string };
      throw new Error(err.message || "Failed to create user");
    }

    const user = await userReader.findByEmail(data.email);
    if (!user) throw new Error("User created but not found");

    // Email verification — user can't log in until they click the link.
    // In dev (flag set) we mark them verified immediately and skip the email.
    if (skipEmailVerification()) {
      await userReader.setEmailVerified(user.id);
    } else {
      await sendVerificationEmailUseCase(authTokenRepo)(user.id, user.email);
    }

    return "ok";
  };
};
