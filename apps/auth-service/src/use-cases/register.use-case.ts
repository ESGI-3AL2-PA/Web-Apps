/**
 * Cas d'usage : inscription d'un nouvel utilisateur.
 *
 * Couche use-case de l'auth-service. L'inscription tourne ici, mais la création
 * effective de l'utilisateur se fait via un appel HTTP à l'api (POST /users)
 * authentifié par un JWT de service éphémère signé par l'auth-service. Après
 * création, un e-mail de vérification est envoyé ; l'utilisateur ne peut pas se
 * connecter avant d'avoir cliqué le lien.
 */
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

/**
 * Choisit fr/en depuis un en-tête Accept-Language, avec fr par défaut. Seules les
 * deux locales supportées comptent : c'est un balayage au premier match, pas un
 * vrai parseur de q-values.
 */
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

/**
 * Factory du cas d'usage d'inscription.
 *
 * @returns Une fonction prenant les données d'inscription et l'en-tête
 *   Accept-Language optionnel. Renvoie `"email-taken"` si l'e-mail existe déjà,
 *   `"ok"` sinon. Lève une erreur si l'appel de création côté api échoue.
 */
export const registerUseCase = (userReader: IUserReaderRepository, authTokenRepo: IAuthTokenRepository) => {
  return async (data: RegisterInput, acceptLanguage?: string): Promise<RegisterResult> => {
    const existing = await userReader.findByEmail(data.email);
    if (existing) return "email-taken";

    // Priorité à la langue d'UI explicite du front, puis à l'Accept-Language du
    // navigateur, puis fr.
    const lang = data.lang ?? langFromAcceptLanguage(acceptLanguage);

    // JWT de service éphémère (30s) pour s'authentifier auprès de l'api (POST /users).
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

    // Vérification d'e-mail — l'utilisateur ne peut pas se connecter avant d'avoir
    // cliqué le lien. En dev, le mail arrive dans mailpit (:8025) au lieu d'une
    // vraie boîte de réception.
    await sendVerificationEmailUseCase(authTokenRepo)(user.id, user.email, lang);

    return "ok";
  };
};
