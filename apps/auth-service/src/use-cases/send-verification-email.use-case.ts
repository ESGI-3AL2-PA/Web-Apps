import { randomBytes, createHash } from "crypto";
import type { IAuthTokenRepository } from "../repositories/AuthToken/auth-token.repository.js";
import { sendVerificationEmail } from "../services/email.service.js";

const AUTH_PUBLIC_URL = process.env.AUTH_PUBLIC_URL ?? "http://localhost:3001";
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24h

/**
 * Cas d'usage : émission et envoi d'un token de vérification d'e-mail.
 *
 * Émet un token de vérification pour l'utilisateur donné, en persiste le hash
 * sha256, et envoie le token brut à l'utilisateur sous forme de lien. Le token
 * expire au bout de 24h.
 */
export const sendVerificationEmailUseCase = (authTokenRepo: IAuthTokenRepository) => {
  return async (userId: string, email: string, lang?: "fr" | "en"): Promise<void> => {
    // Révoque tout token de vérification en cours pour cet utilisateur : seul le
    // dernier émis reste valide.
    await authTokenRepo.revokeAllForUser(userId, "verify_email");

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + VERIFY_TTL_MS);

    await authTokenRepo.create({
      userId,
      tokenHash,
      type: "verify_email",
      expiresAt: expiresAt.toISOString(),
      usedAt: null,
      createdAt: now.toISOString(),
    });

    // Le lien porte le token brut ; le serveur le re-hashera pour retrouver la ligne.
    const link = `${AUTH_PUBLIC_URL}/auth/verify?token=${rawToken}`;
    await sendVerificationEmail(email, link, lang);
  };
};
