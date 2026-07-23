/**
 * Cas d'usage : désactivation du TOTP.
 *
 * Vérifie le mot de passe (argon2) avant d'effacer le secret et de repasser le compte en
 * TOTP désactivé. Le step-up éventuel est imposé en amont dans le router ; ici la
 * confirmation par mot de passe est le dernier garde-fou.
 */
import argon2 from "argon2";
import type { IUserReaderRepository } from "../repositories/User/user-reader.repository.js";

export type DisableTotpResult = "ok" | "user-not-found" | "wrong-password";

// Exige la confirmation par mot de passe pour qu'un attaquant disposant seulement d'un
// access token volé ne puisse pas abaisser la sécurité du compte.
export const disableTotpUseCase = (userReader: IUserReaderRepository) => {
  return async (userId: string, password: string): Promise<DisableTotpResult> => {
    const user = await userReader.findById(userId);
    if (!user) return "user-not-found";

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) return "wrong-password";

    // Efface le secret et repasse enabled=false.
    await userReader.setTotpSecret(userId, null, false);
    return "ok";
  };
};
