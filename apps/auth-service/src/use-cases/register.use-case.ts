import { SignJWT } from "jose";
import type { IUserReaderRepository } from "../repositories/User/user-reader.repository.js";
import type { IAuthTokenRepository } from "../repositories/AuthToken/auth-token.repository.js";
import { getPrivateKey } from "../keys.js";
import { sendVerificationEmailUseCase } from "./send-verification-email.use-case.js";

const API_URL = process.env.API_URL || "http://localhost:3000";

// Current version of the Terms of Service / Privacy Policy. Bump this whenever the
// policies change so the consent record captures exactly which text the user accepted
// (GDPR Art. 7 — consent must be demonstrable and tied to a specific version).
export const TERMS_VERSION = "2026-07-01";

interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  password: string;
  address: string;
  acceptedTerms: boolean;
}

export type RegisterResult = "ok" | "email-taken" | "terms-not-accepted";

export const registerUseCase = (userReader: IUserReaderRepository, authTokenRepo: IAuthTokenRepository) => {
  return async (data: RegisterInput): Promise<RegisterResult> => {
    // Consent gate: registration requires explicit, affirmative acceptance (GDPR Art. 6/7).
    // The contract already enforces `acceptedTerms === true`; this is defence in depth.
    if (data.acceptedTerms !== true) return "terms-not-accepted";

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

    // Record the consent alongside the account: drop the transport-only `acceptedTerms`
    // flag and persist a timestamped, versioned consent record on the user.
    const { acceptedTerms: _acceptedTerms, ...userData } = data;
    const createUserBody = {
      ...userData,
      acceptedTermsAt: new Date().toISOString(),
      termsVersion: TERMS_VERSION,
    };

    const apiRes = await fetch(`${API_URL}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceToken}` },
      body: JSON.stringify(createUserBody),
    });

    if (!apiRes.ok) {
      const err = (await apiRes.json().catch(() => ({}))) as { message?: string };
      throw new Error(err.message || "Failed to create user");
    }

    const user = await userReader.findByEmail(data.email);
    if (!user) throw new Error("User created but not found");

    // Email verification — user can't log in until they click the link. In dev the
    // mail lands in mailpit (:8025) instead of a real inbox.
    await sendVerificationEmailUseCase(authTokenRepo)(user.id, user.email);

    return "ok";
  };
};
