import type { IDistrictAdminRepository } from "../../repositories/DistrictAdmin/district-admin.repository.js";
import type { IUserRepository } from "../../repositories/User/user.repository.js";

export const deleteDistrictAdminUseCase = (repo: IDistrictAdminRepository, userRepo: IUserRepository) => {
  return async ({ id }: { id: string }) => {
    // Resolve the userId before deleting so we can demote them afterwards.
    const assignment = await repo.getDistrictAdminById(id);
    if (!assignment) return false;

    const deleted = await repo.deleteDistrictAdmin(id);
    if (!deleted) return false;

    // Mirror the grant: demote back to a plain resident once this was their last
    // district-admin assignment. Leave superAdmins (or already-demoted users) alone.
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
