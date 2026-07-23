/**
 * Cas d'usage de connexion (auth-service).
 *
 * Vérifie les identifiants puis décide de la suite selon l'état du compte :
 * émission directe des tokens, défi TOTP (MFA), enrôlement forcé, ou rejet
 * (identifiants invalides / banni / email non vérifié). Résultat modélisé par
 * une union discriminée `LoginResult` consommée par le router `/auth/login`.
 */
import argon2 from "argon2";
import { SignJWT } from "jose";
import { TOKEN_AUDIENCE_ENROLL } from "@repo/shared";
import type { IUserReaderRepository } from "../repositories/User/user-reader.repository.js";
import type { IRefreshTokenRepository } from "../repositories/RefreshToken/refresh-token.repository.js";
import type { IDistrictAdminReaderRepository } from "../repositories/DistrictAdmin/district-admin-reader.repository.js";
import { getKeyId, getPrivateKey } from "../keys.js";
import { issueTokensForUser, type IssuedTokens, type SessionContext } from "./issue-tokens.js";

/** Issue de la connexion : succès (avec tokens) ou l'une des raisons de rejet/étape intermédiaire. */
export type LoginResult =
  | ({ kind: "ok" } & IssuedTokens)
  | { kind: "invalid-credentials" }
  | { kind: "banned" }
  | { kind: "email-not-verified" }
  | { kind: "mfa-required"; mfaToken: string }
  | { kind: "enrollment-required"; enrollToken: string };

// Hash argon2 (mis en cache) d'une valeur bidon — vérifié quand l'email est
// inconnu pour que la connexion prenne le même temps que le compte existe ou non
// (contre l'énumération d'utilisateurs par mesure du temps de réponse).
let dummyHash: string | null = null;
const getDummyHash = async () => (dummyHash ??= await argon2.hash("timing-equalizer"));

/**
 * Factory du cas d'usage de connexion. Reçoit ses repositories et renvoie le
 * handler qui prend les identifiants (+ un `SessionContext` optionnel : IP,
 * user-agent) et retourne un `LoginResult`.
 */
export const loginUseCase = (
  userReader: IUserReaderRepository,
  refreshTokenRepo: IRefreshTokenRepository,
  districtAdminReader: IDistrictAdminReaderRepository,
) => {
  return async (data: { email: string; password: string }, context?: SessionContext): Promise<LoginResult> => {
    const user = await userReader.findByEmail(data.email);
    if (!user) {
      // Vérification factice pour égaliser le temps de réponse (voir dummyHash).
      await argon2.verify(await getDummyHash(), data.password).catch(() => false);
      return { kind: "invalid-credentials" };
    }

    const valid = await argon2.verify(user.passwordHash, data.password);
    if (!valid) return { kind: "invalid-credentials" };

    if (user.banned) return { kind: "banned" };

    if (!user.emailVerified) return { kind: "email-not-verified" };

    // Un utilisateur déjà enrôlé est mis au défi de son code TOTP (opt-in ou obligatoire).
    if (user.totpEnabled) {
      // Émet un token MFA à courte durée ; le client doit le POSTer + un code TOTP à /auth/login/mfa.
      const mfaToken = await new SignJWT({})
        .setProtectedHeader({ alg: "RS256", kid: getKeyId() })
        .setSubject(user.id)
        .setIssuer("auth-service")
        .setAudience("mfa")
        .setIssuedAt()
        .setExpirationTime("5m")
        .sign(getPrivateKey());
      return { kind: "mfa-required", mfaToken };
    }

    // En production, le MFA est obligatoire : un utilisateur sans TOTP doit s'enrôler avant
    // qu'aucun token ne soit émis. On renvoie un ticket `enroll` de courte durée qui pilote
    // /auth/login/enroll/*. En dev, cette branche est sautée : le TOTP reste totalement
    // optionnel en local.
    if (process.env.NODE_ENV === "production") {
      const enrollToken = await new SignJWT({})
        .setProtectedHeader({ alg: "RS256", kid: getKeyId() })
        .setSubject(user.id)
        .setIssuer("auth-service")
        .setAudience(TOKEN_AUDIENCE_ENROLL)
        .setIssuedAt()
        .setExpirationTime("10m")
        .sign(getPrivateKey());
      return { kind: "enrollment-required", enrollToken };
    }

    const tokens = await issueTokensForUser(user, refreshTokenRepo, districtAdminReader, context);
    return { kind: "ok", ...tokens };
  };
};
