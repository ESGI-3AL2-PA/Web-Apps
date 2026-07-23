// Cas d'usage (auth-service) : « step-up » d'authentification.
// Pour un utilisateur déjà connecté, vérifie un code TOTP frais et émet un token
// « step-up » de courte durée autorisant UNE opération sensible côté api.
import { SignJWT } from "jose";
import { TOKEN_ALG, TOKEN_ISSUER, TOKEN_AUDIENCE_STEP_UP, type StepUpClaims } from "@repo/shared";
import type { IUserReaderRepository } from "../repositories/User/user-reader.repository.js";
import { getKeyId, getPrivateKey } from "../keys.js";
import { verifyTotpStep } from "../services/totp.js";

// Résultat discriminé : succès avec token, TOTP non activé, ou code invalide/rejoué.
export type StepUpResult = { kind: "ok"; stepUpToken: string } | { kind: "not-enabled" } | { kind: "invalid-code" };

/** Durée de vie du token step-up : assez pour finir une opération, assez court pour rester quasi à usage unique. */
const STEP_UP_TTL = "5m";

/**
 * Vérifie un code TOTP frais pour un utilisateur déjà authentifié et émet un token
 * step-up de courte durée autorisant une opération sensible. Signé avec la même clé
 * que l'access token pour que l'api le valide via le même JWKS (audience « step-up »).
 */
export const stepUpUseCase = (userReader: IUserReaderRepository) => {
  return async (userId: string, code: string): Promise<StepUpResult> => {
    const user = await userReader.findById(userId);
    // Sans TOTP confirmé (secret + flag activé), le step-up n'a pas de sens.
    if (!user || !user.totpEnabled || !user.totpSecret) return { kind: "not-enabled" };

    const step = verifyTotpStep(code, user.totpSecret);
    if (step === null) return { kind: "invalid-code" };
    // Consomme le pas de temps pour empêcher le rejeu du même code dans sa fenêtre.
    if (!(await userReader.consumeTotpStep(userId, step))) return { kind: "invalid-code" };

    const authTime = Math.floor(Date.now() / 1000);
    // JWT signé RS256 : amr=["otp"] et auth_time attestent d'une 2FA fraîche.
    const stepUpToken = await new SignJWT({ amr: ["otp"], auth_time: authTime } satisfies StepUpClaims)
      .setProtectedHeader({ alg: TOKEN_ALG, kid: getKeyId() })
      .setSubject(userId)
      .setIssuer(TOKEN_ISSUER)
      .setAudience(TOKEN_AUDIENCE_STEP_UP)
      .setIssuedAt()
      .setExpirationTime(STEP_UP_TTL)
      .sign(getPrivateKey());

    return { kind: "ok", stepUpToken };
  };
};
