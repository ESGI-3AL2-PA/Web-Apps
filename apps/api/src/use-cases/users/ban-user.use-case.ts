// Cas d'usage : bannissement / dé-bannissement d'un utilisateur.

import type { IUserRepository } from "../../repositories/User/user.repository.js";
import type { User } from "../../entities/user.entity.js";

/** Résultat typé : succès (avec l'utilisateur mis à jour), introuvable, ou interdit (cible non bannissable). */
type BanResult = { kind: "ok"; user: User } | { kind: "not-found" } | { kind: "forbidden" };

/**
 * Factory du cas d'usage de bannissement. Seuls les comptes `user` ordinaires peuvent
 * être bannis — jamais les admins ni les superAdmins (renvoie alors `forbidden`).
 */
export const banUserUseCase = (userRepository: IUserRepository) => {
  return async (id: string, banned: boolean): Promise<BanResult> => {
    const target = await userRepository.getUserById(id);
    if (!target) return { kind: "not-found" };
    if (target.role !== "user") return { kind: "forbidden" };

    const updated = await userRepository.setBanned(id, banned);
    if (!updated) return { kind: "not-found" };
    return { kind: "ok", user: updated };
  };
};
