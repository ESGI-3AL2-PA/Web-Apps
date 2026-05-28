import type { IDistrictRepository } from "../../repositories/District/district.repository.js";

export const getDistrictByIdUseCase = (districtRepository: IDistrictRepository) => {
  return async (params: { id: string }) => {
    return await districtRepository.getDistrictById(params.id);
  };
};
