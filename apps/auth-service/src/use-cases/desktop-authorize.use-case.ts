// Cas d'usage — étape « authorize » du flux SSO OAuth (code + PKCE) du client
// desktop admin (JavaFX). Transforme la session web existante (cookie refresh /auth)
// en un code d'autorisation à usage unique, réservé aux admins/superAdmin.
import { createHash, randomBytes } from "crypto";
import type { IAuthorizationCodeRepository } from "../repositories/AuthorizationCode/authorization-code.repository.js";
import type { IRefreshTokenRepository } from "../repositories/RefreshToken/refresh-token.repository.js";
import type { IUserReaderRepository } from "../repositories/User/user-reader.repository.js";
import { ADMIN_SSO_ROLES, DESKTOP_CLIENT_ID } from "../sso/client-registry.js";

/** Le code est échangé de serveur à serveur en une seconde ou deux après émission. */
const CODE_TTL_MS = 60 * 1000;

export type AuthorizeOutcome =
  | { status: "unauthenticated" }
  | { status: "forbidden"; reason: "role" | "banned" | "unverified" | "totp" }
  | { status: "ok"; code: string };

export interface AuthorizeInput {
  rawRefreshToken: string | null;
  redirectUri: string;
  codeChallenge: string;
  /**
   * `prompt=login` : refuse la session existante et la révoque, pour renvoyer l'appelant
   * vers la page de connexion. C'est ce qui permet le changement de compte côté desktop.
   */
  forceReauth?: boolean;
}

/**
 * Transforme la session navigateur existante de l'appelant (le cookie refresh /auth)
 * en un code d'autorisation à usage unique — mais uniquement pour les admins.
 *
 * Le contrôle de rôle est ici plutôt que dans le client desktop car ce dernier est
 * un jar sur la machine de l'utilisateur : tout contrôle qu'il effectue peut être
 * contourné par patch. Refuser le code côté serveur signifie qu'un non-admin n'a
 * rien à échanger.
 */
export const desktopAuthorizeUseCase = (
  authorizationCodeRepo: IAuthorizationCodeRepository,
  refreshTokenRepo: IRefreshTokenRepository,
  userReader: IUserReaderRepository,
) => {
  return async (input: AuthorizeInput): Promise<AuthorizeOutcome> => {
    if (!input.rawRefreshToken) return { status: "unauthenticated" };

    const tokenHash = createHash("sha256").update(input.rawRefreshToken).digest("hex");

    // Révoquer avant de refuser, pour que l'ancienne session ne puisse pas être
    // réutilisée depuis un autre onglet. Contrairement au chemin de lecture normal
    // ci-dessous, jeter cette session est précisément le but.
    if (input.forceReauth) {
      await refreshTokenRepo.revokeByTokenHash(tokenHash);
      return { status: "unauthenticated" };
    }

    // findActive, pas claim : c'est une *lecture* de la session. Faire tourner le
    // refresh token ici invaliderait le cookie encore détenu par l'onglet navigateur
    // d'où vient l'utilisateur, le déconnectant de l'app web comme effet de bord d'une
    // connexion desktop.
    const session = await refreshTokenRepo.findActiveByTokenHash(tokenHash);
    if (!session) return { status: "unauthenticated" };
    if (new Date(session.expiresAt) < new Date()) return { status: "unauthenticated" };

    const user = await userReader.findById(session.userId);
    if (!user) return { status: "unauthenticated" };

    if (user.banned) return { status: "forbidden", reason: "banned" };
    if (!user.emailVerified) return { status: "forbidden", reason: "unverified" };
    if (!ADMIN_SSO_ROLES.has(user.role)) return { status: "forbidden", reason: "role" };
    // Défense en profondeur pour la MFA obligatoire : même si un code desktop est
    // frappé depuis une session web existante (qui en prod n'existe qu'après enrôlement),
    // on refuse d'en émettre pour un admin non enrôlé afin que ce chemin ne puisse jamais
    // devenir un contournement de MFA.
    if (process.env.NODE_ENV === "production" && !user.totpEnabled) return { status: "forbidden", reason: "totp" };

    const code = randomBytes(32).toString("hex");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CODE_TTL_MS);

    await authorizationCodeRepo.create({
      codeHash: createHash("sha256").update(code).digest("hex"),
      clientId: DESKTOP_CLIENT_ID,
      userId: user.id,
      redirectUri: input.redirectUri,
      codeChallenge: input.codeChallenge,
      expiresAt: expiresAt.toISOString(),
      expiresAtDate: expiresAt,
      usedAt: null,
      createdAt: now.toISOString(),
    });

    return { status: "ok", code };
  };
};
