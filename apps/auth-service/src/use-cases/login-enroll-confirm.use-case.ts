// Cas d'usage : étape 2 de l'enrôlement TOTP obligatoire lors du login. Vérifie le
// ticket `enroll`, confirme le premier code, puis émet les vrais tokens de session.
import { jwtVerify } from "jose";
import { TOKEN_ISSUER, TOKEN_AUDIENCE_ENROLL } from "@repo/shared";
import type { IUserReaderRepository } from "../repositories/User/user-reader.repository.js";
import type { IRefreshTokenRepository } from "../repositories/RefreshToken/refresh-token.repository.js";
import type { IDistrictAdminReaderRepository } from "../repositories/DistrictAdmin/district-admin-reader.repository.js";
import { getPublicKey } from "../keys.js";
import { confirmTotpUseCase } from "./confirm-totp.use-case.js";
import { issueTokensForUser, type IssuedTokens, type SessionContext } from "./issue-tokens.js";

/** Résultat de la confirmation d'enrôlement : succès (avec tokens), ticket invalide, ou code TOTP invalide. */
export type LoginEnrollConfirmResult =
  | ({ kind: "ok" } & IssuedTokens)
  | { kind: "invalid-token" }
  | { kind: "invalid-code" };

/**
 * Cérémonie d'enrôlement obligatoire (étape 2). Vérifie le ticket `enroll`, confirme le
 * premier code TOTP (passe totpEnabled=true), puis émet les vrais tokens — bouclant le
 * flux pour qu'un utilisateur fraîchement enrôlé soit authentifié exactement comme via /auth/login/mfa.
 */
export const loginEnrollConfirmUseCase = (
  userReader: IUserReaderRepository,
  refreshTokenRepo: IRefreshTokenRepository,
  districtAdminReader: IDistrictAdminReaderRepository,
) => {
  const confirm = confirmTotpUseCase(userReader);
  return async (enrollToken: string, code: string, context?: SessionContext): Promise<LoginEnrollConfirmResult> => {
    let userId: string;
    try {
      // Vérifie le ticket `enroll` (audience dédiée, RS256) et en extrait le sujet.
      const { payload } = await jwtVerify(enrollToken, getPublicKey(), {
        algorithms: ["RS256"],
        issuer: TOKEN_ISSUER,
        audience: TOKEN_AUDIENCE_ENROLL,
      });
      if (!payload.sub) return { kind: "invalid-token" };
      userId = payload.sub;
    } catch {
      return { kind: "invalid-token" };
    }

    // Confirme le premier code TOTP : distingue code invalide et échec générique.
    const result = await confirm(userId, code);
    if (result === "invalid-code") return { kind: "invalid-code" };
    if (result !== "ok") return { kind: "invalid-token" };

    const user = await userReader.findById(userId);
    if (!user) return { kind: "invalid-token" };

    // Enrôlement confirmé : émet la session complète (access + refresh).
    const tokens = await issueTokensForUser(user, refreshTokenRepo, districtAdminReader, context);
    return { kind: "ok", ...tokens };
  };
};
