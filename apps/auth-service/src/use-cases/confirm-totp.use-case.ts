/**
 * Cas d'usage : confirmation d'enrôlement TOTP.
 *
 * Termine la cérémonie démarrée par enroll-totp : vérifie le premier code contre le
 * secret en attente, consomme le step (anti-rejeu), puis active le TOTP en le persistant
 * avec le même secret et enabled=true.
 */
import type { IUserReaderRepository } from "../repositories/User/user-reader.repository.js";
import { verifyTotpStep } from "../services/totp.js";

export type ConfirmTotpResult = "ok" | "user-not-found" | "no-enrollment" | "invalid-code";

/** Factory du cas d'usage : reçoit le repository lecteur d'utilisateurs, renvoie l'exécuteur. */
export const confirmTotpUseCase = (userReader: IUserReaderRepository) => {
  return async (userId: string, code: string): Promise<ConfirmTotpResult> => {
    const user = await userReader.findById(userId);
    if (!user) return "user-not-found";
    // Pas de secret en attente => aucun enrôlement à confirmer.
    if (!user.totpSecret) return "no-enrollment";

    const step = verifyTotpStep(code, user.totpSecret);
    if (step === null) return "invalid-code";
    // Consomme le step pour que le même code d'enrôlement ne puisse pas être rejoué.
    if (!(await userReader.consumeTotpStep(userId, step))) return "invalid-code";

    await userReader.setTotpSecret(userId, user.totpSecret, true);
    return "ok";
  };
};
