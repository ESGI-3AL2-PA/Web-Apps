// Cas d'usage : second facteur du login (MFA). Vérifie le ticket `mfa` court émis à
// l'étape 1, valide le code TOTP (avec protection anti-rejeu), puis émet la session complète.
import { jwtVerify } from "jose";
import type { IUserReaderRepository } from "../repositories/User/user-reader.repository.js";
import type { IRefreshTokenRepository } from "../repositories/RefreshToken/refresh-token.repository.js";
import type { IDistrictAdminReaderRepository } from "../repositories/DistrictAdmin/district-admin-reader.repository.js";
import { getPublicKey } from "../keys.js";
import { verifyTotpStep } from "../services/totp.js";
import { issueTokensForUser, type IssuedTokens, type SessionContext } from "./issue-tokens.js";

/** Résultat du login MFA : succès (avec tokens), ticket invalide, code invalide, utilisateur absent, ou TOTP non activé. */
export type LoginMfaResult =
  | ({ kind: "ok" } & IssuedTokens)
  | { kind: "invalid-mfa-token" }
  | { kind: "invalid-code" }
  | { kind: "user-not-found" }
  | { kind: "totp-not-enabled" };

/**
 * Étape 2 du login pour un utilisateur ayant le TOTP activé. Vérifie le ticket `mfa`,
 * valide le code une fois (protection anti-rejeu via consumeTotpStep), puis émet la session.
 */
export const loginMfaUseCase = (
  userReader: IUserReaderRepository,
  refreshTokenRepo: IRefreshTokenRepository,
  districtAdminReader: IDistrictAdminReaderRepository,
) => {
  return async (mfaToken: string, code: string, context?: SessionContext): Promise<LoginMfaResult> => {
    let userId: string;
    try {
      // Vérifie le ticket MFA court (émetteur auth-service, audience mfa, RS256) et en extrait le sujet.
      const { payload } = await jwtVerify(mfaToken, getPublicKey(), {
        algorithms: ["RS256"],
        issuer: "auth-service",
        audience: "mfa",
      });
      if (!payload.sub) return { kind: "invalid-mfa-token" };
      userId = payload.sub;
    } catch {
      return { kind: "invalid-mfa-token" };
    }

    const user = await userReader.findById(userId);
    if (!user) return { kind: "user-not-found" };
    if (!user.totpEnabled || !user.totpSecret) return { kind: "totp-not-enabled" };

    // Résout le code TOTP en son numéro de pas temporel ; null = code hors de la fenêtre de tolérance.
    const step = verifyTotpStep(code, user.totpSecret);
    if (step === null) return { kind: "invalid-code" };
    // Rejette un code déjà consommé dans sa fenêtre (protection anti-rejeu) : consumeTotpStep échoue si le pas est déjà pris.
    if (!(await userReader.consumeTotpStep(userId, step))) return { kind: "invalid-code" };

    // Second facteur prouvé : émet la session complète.
    const tokens = await issueTokensForUser(user, refreshTokenRepo, districtAdminReader, context);
    return { kind: "ok", ...tokens };
  };
};
