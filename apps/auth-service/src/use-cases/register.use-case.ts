import { SignJWT } from "jose";
import { TOKEN_ISSUER, TOKEN_ALG, TOKEN_AUDIENCE_INTERNAL } from "@repo/shared";
import type { IUserReaderRepository } from "../repositories/User/user-reader.repository.js";
import type { IAuthTokenRepository } from "../repositories/AuthToken/auth-token.repository.js";
import { getKeyId, getPrivateKey } from "../keys.js";
import { sendVerificationEmailUseCase } from "./send-verification-email.use-case.js";

const API_URL = process.env.API_URL || "http://localhost:3000";

type Lang = "fr" | "en";

interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  password: string;
  address: string;
  lang?: Lang;
}

// Picks fr/en from an Accept-Language header, defaulting to fr. Only the two
// supported locales matter, so this is a first-match scan, not a full q-value parse.
const langFromAcceptLanguage = (header?: string): Lang => {
  if (!header) return "fr";
  for (const part of header.toLowerCase().split(",")) {
    const tag = part.trim().split(";")[0] ?? "";
    if (tag.startsWith("en")) return "en";
    if (tag.startsWith("fr")) return "fr";
  }
  return "fr";
};

export type RegisterResult = "ok" | "email-taken";

export const registerUseCase = (userReader: IUserReaderRepository, authTokenRepo: IAuthTokenRepository) => {
  return async (data: RegisterInput, acceptLanguage?: string): Promise<RegisterResult> => {
    const existing = await userReader.findByEmail(data.email);
    if (existing) return "email-taken";

    // Prefer the explicit UI language from the front, then the browser's Accept-Language, then fr.
    const lang = data.lang ?? langFromAcceptLanguage(acceptLanguage);

    // Short-lived service JWT to authenticate with the API (POST /users).
    const serviceToken = await new SignJWT({
      role: "service",
    })
      .setProtectedHeader({ alg: TOKEN_ALG, kid: getKeyId() })
      .setSubject(TOKEN_ISSUER)
      .setIssuer(TOKEN_ISSUER)
      .setAudience(TOKEN_AUDIENCE_INTERNAL)
      .setIssuedAt()
      .setExpirationTime("30s")
      .sign(getPrivateKey());

    const apiRes = await fetch(`${API_URL}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceToken}` },
      body: JSON.stringify({ ...data, lang }),
    });

    if (!apiRes.ok) {
      const err = (await apiRes.json().catch(() => ({}))) as { message?: string };
      throw new Error(err.message || "Failed to create user");
    }

    const user = await userReader.findByEmail(data.email);
    if (!user) throw new Error("User created but not found");

    // Email verification — user can't log in until they click the link. In dev the
    // mail lands in mailpit (:8025) instead of a real inbox.
    await sendVerificationEmailUseCase(authTokenRepo)(user.id, user.email, lang);

    return "ok";
  };
};
