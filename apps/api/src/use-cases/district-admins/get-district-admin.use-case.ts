import type { IDistrictAdminRepository } from "../../repositories/DistrictAdmin/district-admin.repository.js";

export const getDistrictAdminUseCase = (repo: IDistrictAdminRepository) => {
  return async ({ id }: { id: string }) => {
    return await repo.getDistrictAdminById(id);
  };
};
