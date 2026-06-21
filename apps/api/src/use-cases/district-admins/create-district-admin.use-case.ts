import type { CreateDistrictAdminDto, DistrictAdminResponseDto } from "@repo/contracts";
import type { IDistrictAdminRepository } from "../../repositories/DistrictAdmin/district-admin.repository.js";

// Signals the router that the (districtId, userId) pair already exists.
// The router translates this to a 409 Conflict response.
export class DistrictAdminAlreadyExistsError extends Error {
  constructor() {
    super("This user is already an admin of this district");
    this.name = "DistrictAdminAlreadyExistsError";
  }
}

export const createDistrictAdminUseCase = (repo: IDistrictAdminRepository) => {
  return async (data: CreateDistrictAdminDto): Promise<DistrictAdminResponseDto> => {
    const existing = await repo.findExisting(data.districtId, data.userId);
    if (existing) throw new DistrictAdminAlreadyExistsError();
    return await repo.createDistrictAdmin(data);
  };
};
