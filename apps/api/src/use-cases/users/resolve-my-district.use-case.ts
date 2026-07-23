import type { District } from "../../entities/district.entity.js";
import type { User } from "../../entities/user.entity.js";
import { getCoordinatesFromAddress } from "../../services/address.service.js";
import { logger } from "../../logger.js";
import { joinDistrict, type MembershipDeps } from "./district-membership.use-case.js";

// Résultat : `resolved` indique si l'utilisateur a bien été rattaché ; `candidates` liste les
// quartiers possibles quand un choix reste à faire (chevauchement ou choix invalide).
type ResolveResult = { resolved: boolean; user?: User; candidates: District[] };

/**
 * Cas d'usage (domaine users) : re-géocode l'adresse enregistrée de l'appelant et le rattache
 * au quartier qui la contient. Idempotent — un utilisateur qui a déjà un quartier est renvoyé
 * inchangé. Comportement selon le nombre de quartiers englobant l'adresse :
 * - exactement un => on le rejoint ;
 * - plusieurs => renvoyés comme `candidates` (aucun rattachement), sauf si l'appelant fournit
 *   un `chosenDistrictId` faisant partie des candidats ;
 * - aucun => `resolved: false`, candidats vides.
 * Un échec de géocodage/recherche laisse l'utilisateur non résolu (aucune mutation).
 */
export const resolveMyDistrictUseCase = (deps: MembershipDeps) => {
  return async (userId: string, chosenDistrictId?: string): Promise<ResolveResult> => {
    const user = await deps.userRepository.getUserById(userId);
    if (!user) return { resolved: false, candidates: [] };
    if (user.districtId) return { resolved: true, user, candidates: [] };

    let matches: District[] = [];
    try {
      // Géocode l'adresse, puis interroge les quartiers dont le polygone contient le point.
      const coordinates = await getCoordinatesFromAddress(user.address);
      matches = await deps.districtRepository.findDistrictsContaining(coordinates);
    } catch (err) {
      logger.error({ err, userId }, "resolve-my-district: geocode/lookup failed");
      return { resolved: false, candidates: [] };
    }

    if (matches.length === 0) return { resolved: false, candidates: [] };

    let target: District | undefined;
    if (chosenDistrictId) {
      target = matches.find((d) => d.id === chosenDistrictId);
      if (!target) return { resolved: false, candidates: matches }; // choix invalide — on re-présente
    } else if (matches.length === 1) {
      target = matches[0];
    } else {
      return { resolved: false, candidates: matches }; // chevauchement — l'utilisateur doit choisir
    }

    const joined = await joinDistrict(deps, userId, target!.id);
    return joined ? { resolved: true, user: joined, candidates: [] } : { resolved: false, candidates: [] };
  };
};
