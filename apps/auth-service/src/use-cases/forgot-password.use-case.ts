// Cas d'usage : mot de passe oublié. Émet un token de réinitialisation à usage
// unique et envoie le lien par e-mail. Toujours silencieux pour éviter
// l'énumération des comptes existants.
import { randomBytes, createHash } from "crypto";
import type { IAuthTokenRepository } from "../repositories/AuthToken/auth-token.repository.js";
import type { IUserReaderRepository } from "../repositories/User/user-reader.repository.js";
import { sendPasswordResetEmail } from "../services/email.service.js";

// Base d'URL publique utilisée pour construire le lien du mail de réinitialisation.
const AUTH_PUBLIC_URL = process.env.AUTH_PUBLIC_URL ?? "http://localhost:3001";
const RESET_TTL_MS = 60 * 60 * 1000; // durée de validité du token : 1 h

/**
 * Toujours silencieux (pas d'énumération d'utilisateurs) : ne signale jamais si l'e-mail
 * existe. Si l'e-mail correspond à un utilisateur, révoque les tokens de réinitialisation
 * précédents, en génère un nouveau et envoie le lien par e-mail.
 */
export const forgotPasswordUseCase = (userReader: IUserReaderRepository, authTokenRepo: IAuthTokenRepository) => {
  return async (email: string): Promise<void> => {
    const user = await userReader.findByEmail(email);
    if (!user) return; // sortie silencieuse : aucun indice sur l'existence du compte

    // Invalide tout token de réinitialisation antérieur : un seul lien valable à la fois.
    await authTokenRepo.revokeAllForUser(user.id, "reset_password");

    // Token brut envoyé dans le mail ; on ne stocke que son empreinte sha256 en base.
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + RESET_TTL_MS);

    await authTokenRepo.create({
      userId: user.id,
      tokenHash,
      type: "reset_password",
      expiresAt: expiresAt.toISOString(),
      usedAt: null,
      createdAt: now.toISOString(),
    });

    // Lien porteur du token brut ; la langue de l'utilisateur choisit le gabarit du mail.
    const link = `${AUTH_PUBLIC_URL}/reset-password?token=${rawToken}`;
    await sendPasswordResetEmail(user.email, link, user.lang);
  };
};
