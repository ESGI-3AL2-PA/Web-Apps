import type { IDistrictRepository } from "../../repositories/District/district.repository.js";

export const deleteDistrictUseCase = (districtRepository: IDistrictRepository) => {
  return async (params: { id: string }): Promise<boolean> => {
    return await districtRepository.deleteDistrict(params.id);
  };
};
