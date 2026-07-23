// Cas d'usage (couche district-admins) : révoquer une affectation d'administrateur de
// quartier, et rétrograder l'utilisateur en simple résident si c'était sa dernière.
import type { IDistrictAdminRepository } from "../../repositories/DistrictAdmin/district-admin.repository.js";
import type { IUserRepository } from "../../repositories/User/user.repository.js";

/**
 * Factory du cas d'usage « supprimer un administrateur de quartier ».
 * @param repo repository des affectations d'administrateurs de quartier
 * @param userRepo repository des utilisateurs (pour la rétrogradation du rôle)
 * @returns une fonction ({ id }) → `true` si l'affectation a été supprimée, `false` si
 *   elle est introuvable ou n'a pas pu être supprimée.
 */
export const deleteDistrictAdminUseCase = (repo: IDistrictAdminRepository, userRepo: IUserRepository) => {
  return async ({ id }: { id: string }) => {
    // On résout le userId avant la suppression pour pouvoir le rétrograder ensuite.
    const assignment = await repo.getDistrictAdminById(id);
    if (!assignment) return false;

    const deleted = await repo.deleteDistrictAdmin(id);
    if (!deleted) return false;

    // Symétrique de l'octroi : on rétrograde en simple résident dès lors que c'était sa
    // dernière affectation d'administrateur de quartier. On laisse les superAdmins (ou les
    // utilisateurs déjà rétrogradés) intacts.
    const remaining = await repo.listDistrictAdmins({ userId: assignment.userId, limit: 1 });
    if (remaining.total === 0) {
      const user = await userRepo.getUserById(assignment.userId);
      if (user?.role === "admin") {
        await userRepo.updateUser(assignment.userId, { role: "user" });
      }
    }
    return true;
  };
};
