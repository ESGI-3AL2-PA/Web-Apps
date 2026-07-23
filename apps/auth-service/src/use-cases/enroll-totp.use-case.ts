// Cas d'usage : démarrage de l'enrôlement TOTP (2FA). Génère un secret TOTP et
// renvoie l'URL otpauth à afficher sous forme de QR code. Le facteur reste
// désactivé tant que l'utilisateur n'a pas confirmé un premier code (voir
// confirm-totp.use-case).
import { authenticator } from "otplib";
import type { IUserReaderRepository } from "../repositories/User/user-reader.repository.js";

// Libellé émetteur affiché dans l'application d'authentification (ex. Google Authenticator).
const ISSUER_LABEL = process.env.TOTP_ISSUER ?? "Web-Apps";

/** Résultat de l'enrôlement : succès (avec URL otpauth + secret), utilisateur introuvable, ou TOTP déjà actif. */
export type EnrollTotpResult =
  | { kind: "ok"; otpauthUrl: string; secret: string }
  | { kind: "user-not-found" }
  | { kind: "already-enabled" };

/**
 * Génère un nouveau secret TOTP et l'enregistre avec enabled=false. L'utilisateur doit
 * ensuite confirmer un code issu de son application d'authentification pour passer enabled=true.
 * Refuse de régénérer un secret si le TOTP est déjà activé.
 */
export const enrollTotpUseCase = (userReader: IUserReaderRepository) => {
  return async (userId: string): Promise<EnrollTotpResult> => {
    const user = await userReader.findById(userId);
    if (!user) return { kind: "user-not-found" };
    if (user.totpEnabled) return { kind: "already-enabled" };

    const secret = authenticator.generateSecret();
    // Stocke le secret mais laisse le facteur inactif (enabled=false) jusqu'à confirmation.
    await userReader.setTotpSecret(userId, secret, false);

    // Construit l'URI otpauth:// (encode émetteur, e-mail et secret) pour le QR code.
    const otpauthUrl = authenticator.keyuri(user.email, ISSUER_LABEL, secret);
    return { kind: "ok", otpauthUrl, secret };
  };
};
