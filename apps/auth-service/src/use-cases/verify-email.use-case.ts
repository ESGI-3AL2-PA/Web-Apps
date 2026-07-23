/**
 * Cas d'usage (couche use-case) : vérification d'une adresse e-mail à partir du
 * token reçu par lien. Valide le token stocké côté auth-service, marque le compte
 * comme vérifié puis consomme le token. Dépend des repositories AuthToken et
 * UserReader (injectés), et renvoie des données simples.
 */
import { createHash } from "crypto";
import type { IAuthTokenRepository } from "../repositories/AuthToken/auth-token.repository.js";
import type { IUserReaderRepository } from "../repositories/User/user-reader.repository.js";

/** Issues possibles de la vérification, mappées vers un statut HTTP par le router. */
export type VerifyEmailResult = "ok" | "invalid" | "expired" | "user-not-found";

/**
 * Factory du cas d'usage : reçoit les repositories et retourne la fonction qui
 * vérifie un token brut (`rawToken`, tel qu'il figure dans le lien d'e-mail).
 */
export const verifyEmailUseCase = (authTokenRepo: IAuthTokenRepository, userReader: IUserReaderRepository) => {
  return async (rawToken: string): Promise<VerifyEmailResult> => {
    // Le token n'est jamais stocké en clair : on cherche par son empreinte sha256.
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    // Token actif (non consommé) du bon type ; absent => inconnu ou déjà utilisé.
    const record = await authTokenRepo.findActiveByHash(tokenHash, "verify_email");
    if (!record) return "invalid";

    // Token périmé : on le brûle quand même pour éviter toute réutilisation.
    if (new Date(record.expiresAt) < new Date()) {
      await authTokenRepo.markUsed(record.id);
      return "expired";
    }

    // Le compte a pu être supprimé entre l'envoi et la vérification.
    const user = await userReader.findById(record.userId);
    if (!user) return "user-not-found";

    // Succès : on marque l'e-mail vérifié puis on consomme le token (usage unique).
    await userReader.setEmailVerified(record.userId);
    await authTokenRepo.markUsed(record.id);
    return "ok";
  };
};
