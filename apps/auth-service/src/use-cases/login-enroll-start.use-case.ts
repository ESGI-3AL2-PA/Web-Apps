// Cas d'usage : étape 1 de l'enrôlement TOTP obligatoire lors du login. Vérifie le
// ticket `enroll` court émis par login et génère un secret TOTP à présenter en QR code.
import { jwtVerify } from "jose";
import { TOKEN_ISSUER, TOKEN_AUDIENCE_ENROLL } from "@repo/shared";
import type { IUserReaderRepository } from "../repositories/User/user-reader.repository.js";
import { getPublicKey } from "../keys.js";
import { enrollTotpUseCase } from "./enroll-totp.use-case.js";

/** Résultat du démarrage d'enrôlement : succès (URL otpauth + secret), ticket invalide, ou TOTP déjà actif. */
export type LoginEnrollStartResult =
  | { kind: "ok"; otpauthUrl: string; secret: string }
  | { kind: "invalid-token" }
  | { kind: "already-enabled" };

/**
 * Cérémonie d'enrôlement obligatoire (étape 1). Vérifie le ticket `enroll` court émis par
 * le cas d'usage login et génère un secret TOTP — sans jamais nécessiter l'access token
 * `aud:"api"` que l'utilisateur ne peut pas encore obtenir (aucun facteur confirmé).
 */
export const loginEnrollStartUseCase = (userReader: IUserReaderRepository) => {
  const enroll = enrollTotpUseCase(userReader);
  return async (enrollToken: string): Promise<LoginEnrollStartResult> => {
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

    // Génère le secret ; « user-not-found » est mappé sur invalid-token pour ne rien divulguer.
    const result = await enroll(userId);
    if (result.kind === "ok") return { kind: "ok", otpauthUrl: result.otpauthUrl, secret: result.secret };
    if (result.kind === "already-enabled") return { kind: "already-enabled" };
    return { kind: "invalid-token" };
  };
};
