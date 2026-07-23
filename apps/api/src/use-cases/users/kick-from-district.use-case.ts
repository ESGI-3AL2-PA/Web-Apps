import type { User } from "../../entities/user.entity.js";
import { leaveDistrict, type MembershipDeps } from "./district-membership.use-case.js";

// Résultat discriminé : succès, cible introuvable, ou action interdite (cible non-`user`).
type KickResult = { kind: "ok"; user: User } | { kind: "not-found" } | { kind: "forbidden" };

/**
 * Cas d'usage (domaine users) : exclut un utilisateur ordinaire de son quartier, en
 * redistribuant ses points aux membres restants (via `leaveDistrict`). Seuls les comptes
 * de rôle `user` peuvent être exclus — jamais un admin ni un superAdmin. À distinguer du
 * bannissement : ce cas d'usage ne touche pas au champ `banned`, uniquement à l'appartenance
 * au quartier et aux points.
 */
export const kickFromDistrictUseCase = (deps: MembershipDeps) => {
  return async (id: string): Promise<KickResult> => {
    const target = await deps.userRepository.getUserById(id);
    if (!target) return { kind: "not-found" };
    if (target.role !== "user") return { kind: "forbidden" };
    if (!target.districtId) return { kind: "ok", user: target }; // déjà sans quartier

    const updated = await leaveDistrict(deps, id);
    if (!updated) return { kind: "not-found" };
    return { kind: "ok", user: updated };
  };
};
