import type { District } from "../../entities/district.entity.js";
import type { IDistrictRepository, UpdateDistrictData } from "../../repositories/District/district.repository.js";

export const updateDistrictUseCase = (districtRepository: IDistrictRepository) => {
  return async (id: string, data: UpdateDistrictData): Promise<District | null> => {
    return await districtRepository.updateDistrict(id, data);
  };
};
