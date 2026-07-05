import type { IDistrictRepository } from "../../repositories/District/district.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";

export const deleteDistrictUseCase = (districtRepository: IDistrictRepository, graphRepository: IGraphRepository) => {
  return async (params: { id: string }): Promise<boolean> => {
    const deleted = await districtRepository.deleteDistrict(params.id);
    if (deleted) {
      await syncGraph(`deleteDistrict(${params.id})`, () => graphRepository.deleteDistrict(params.id));
    }
    return deleted;
  };
};
