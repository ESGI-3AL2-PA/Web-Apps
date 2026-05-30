import type { CreateDistrictDto } from "@repo/contracts";
import type { District } from "../../entities/district.entity.js";
import type { IDistrictRepository } from "../../repositories/District/district.repository.js";

export const createDistrictUseCase = (districtRepository: IDistrictRepository) => {
  return async (data: CreateDistrictDto): Promise<District> => {
    return await districtRepository.createDistrict(data);
  };
};
