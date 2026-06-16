import type { CreateDistrictDto } from "@repo/contracts";
import type { District } from "../../entities/district.entity.js";
import type { IDistrictRepository } from "../../repositories/District/district.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";

export const createDistrictUseCase = (
  districtRepository: IDistrictRepository,
  graphRepository: IGraphRepository,
) => {
  return async (data: CreateDistrictDto): Promise<District> => {
    const district = await districtRepository.createDistrict(data);
    await syncGraph(`upsertDistrict(${district.id})`, () =>
      graphRepository.upsertDistrict({ id: district.id, name: district.name }),
    );
    return district;
  };
};
