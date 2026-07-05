import type { IDistrictAdminRepository } from "../../repositories/DistrictAdmin/district-admin.repository.js";

export const deleteDistrictAdminUseCase = (repo: IDistrictAdminRepository) => {
  return async ({ id }: { id: string }) => {
    return await repo.deleteDistrictAdmin(id);
  };
};
