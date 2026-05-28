import type { IDistrictRepository } from "../../repositories/District/district.repository.js";

export const getDistrictsUseCase = (districtRepository: IDistrictRepository) => {
  return async (params: { search?: string; page?: number; limit?: number }) => {
    return await districtRepository.getDistricts(params);
  };
};
