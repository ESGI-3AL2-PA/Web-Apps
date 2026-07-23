// Cas d'usage (couche district-admins) : nommer un utilisateur administrateur de quartier.
// Crée la ligne d'affectation puis synchronise le rôle et la résidence de l'utilisateur —
// le rôle JWT étant dérivé du user au login, l'affectation seule ne donne aucun droit.
import type { CreateDistrictAdminDto, DistrictAdminResponseDto } from "@repo/contracts";
import type { IDistrictAdminRepository } from "../../repositories/DistrictAdmin/district-admin.repository.js";
import { joinDistrict, type MembershipDeps } from "../users/district-membership.use-case.js";

/**
 * Signale au routeur que la paire (districtId, userId) existe déjà.
 * Le routeur la traduit en réponse 409 Conflict.
 */
export class DistrictAdminAlreadyExistsError extends Error {
  constructor() {
    super("This user is already an admin of this district");
    this.name = "DistrictAdminAlreadyExistsError";
  }
}

// Code d'erreur Mongo pour clé dupliquée. L'index unique (districtId, userId) est le vrai
// garde-fou ; le findExisting ci-dessous n'est qu'une pré-vérification rapide qu'un insert
// concurrent peut griller (race condition).
const isDuplicateKeyError = (err: unknown): boolean =>
  typeof err === "object" && err !== null && "code" in err && (err as { code?: unknown }).code === 11000;

/**
 * Factory du cas d'usage « créer un administrateur de quartier ».
 * @param repo repository des affectations d'administrateurs de quartier
 * @param deps dépendances d'appartenance (user/district/transaction/graph) pour rattacher
 *   un promu sans quartier et créditer les points initiaux via le registre
 * @returns une fonction (CreateDistrictAdminDto) → la ligne d'affectation créée.
 *   Lève DistrictAdminAlreadyExistsError (→ 409) si la paire existe déjà.
 */
export const createDistrictAdminUseCase = (repo: IDistrictAdminRepository, deps: MembershipDeps) => {
  return async (data: CreateDistrictAdminDto): Promise<DistrictAdminResponseDto> => {
    const existing = await repo.findExisting(data.districtId, data.userId);
    if (existing) throw new DistrictAdminAlreadyExistsError();
    let created: DistrictAdminResponseDto;
    try {
      created = await repo.createDistrictAdmin(data);
    } catch (err) {
      // Course perdue face à l'index unique — on remonte le même conflit 409 plutôt que
      // de laisser s'échapper un 500 non déclaré.
      if (isDuplicateKeyError(err)) throw new DistrictAdminAlreadyExistsError();
      throw err;
    }
    // Le rôle JWT est forgé depuis le user au login, et adminDistrictId n'est résolu que
    // pour le rôle "admin" — donc la ligne d'affectation seule ne donne aucun droit.
    // On promeut un simple résident ; on laisse un superAdmin (global) intact.
    const user = await deps.userRepository.getUserById(data.userId);
    if (user?.role === "user") {
      await deps.userRepository.updateUser(data.userId, { role: "admin" });
    }
    // Invariant : un admin non-superAdmin doit résider dans le quartier qu'il administre.
    // Un promu sans quartier (districtId vide) y est rattaché ici — ce qui fixe sa
    // résidence et lui octroie les points initiaux du quartier via le registre. Un résident
    // déjà rattaché garde son quartier (l'invariant n'interdit que le vide), et un
    // superAdmin (global) est exempté — il peut rester sans quartier.
    if (user && user.role !== "superAdmin" && !user.districtId) {
      await joinDistrict(deps, data.userId, data.districtId);
    }
    return created;
  };
};
