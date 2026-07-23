import type { IAuthTokenRepository } from "../repositories/AuthToken/auth-token.repository.js";
import type { IUserReaderRepository } from "../repositories/User/user-reader.repository.js";
import { sendVerificationEmailUseCase } from "./send-verification-email.use-case.js";

/**
 * Cas d'usage : renvoi de l'e-mail de vérification.
 *
 * Réussit toujours silencieusement pour éviter l'énumération d'utilisateurs : la
 * réponse est identique que l'e-mail existe ou non. Si l'utilisateur existe et
 * n'est pas encore vérifié, un nouvel e-mail de vérification est envoyé ; sinon,
 * aucune action.
 */
export const resendVerificationUseCase = (userReader: IUserReaderRepository, authTokenRepo: IAuthTokenRepository) => {
  return async (email: string): Promise<void> => {
    const user = await userReader.findByEmail(email);
    if (!user || user.emailVerified) return;
    await sendVerificationEmailUseCase(authTokenRepo)(user.id, user.email, user.lang);
  };
};
