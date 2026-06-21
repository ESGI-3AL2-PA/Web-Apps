import type { IDistrictAdminRepository } from "../../repositories/DistrictAdmin/district-admin.repository.js";

export const listDistrictAdminsUseCase = (repo: IDistrictAdminRepository) => {
  return async (params: {
    districtId?: string;
    userId?: string;
    page?: number;
    limit?: number;
  }) => {
    return await repo.listDistrictAdmins(params);
  };
};
