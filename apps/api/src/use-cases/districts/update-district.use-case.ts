import type { District } from "../../entities/district.entity.js";
import type { IDistrictRepository, UpdateDistrictData } from "../../repositories/District/district.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";

export const updateDistrictUseCase = (districtRepository: IDistrictRepository, graphRepository: IGraphRepository) => {
  return async (id: string, data: UpdateDistrictData): Promise<District | null> => {
    const district = await districtRepository.updateDistrict(id, data);
    if (district && data.name !== undefined) {
      await syncGraph(`upsertDistrict(${district.id})`, () =>
        graphRepository.upsertDistrict({ id: district.id, name: district.name }),
      );
    }
    return district;
  };
};
