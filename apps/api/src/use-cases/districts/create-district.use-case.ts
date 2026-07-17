import type { CreateDistrictDto } from "@repo/contracts";
import type { District } from "../../entities/district.entity.js";
import type { IDistrictRepository } from "../../repositories/District/district.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import type { IUserRepository } from "../../repositories/User/user.repository.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";
import { checkMembersWithinPolygon } from "./check-members-within-polygon.use-case.js";

export type CreateDistrictResult =
  | { kind: "ok"; district: District }
  | { kind: "members-outside"; outside: { id: string; address: string }[] };

export const createDistrictUseCase = (
  districtRepository: IDistrictRepository,
  graphRepository: IGraphRepository,
  userRepository: IUserRepository,
) => {
  return async (data: CreateDistrictDto): Promise<CreateDistrictResult> => {
    const district = await districtRepository.createDistrict(data);

    // Enforce the boundary invariant on create too. A brand-new id has no members yet,
    // so this only bites if the id already had members; if so, roll back the insert.
    if (data.geoJson) {
      const outside = await checkMembersWithinPolygon(userRepository, district.id, data.geoJson);
      if (outside.length > 0) {
        await districtRepository.deleteDistrict(district.id);
        return { kind: "members-outside", outside };
      }
    }

    await syncGraph(`upsertDistrict(${district.id})`, () =>
      graphRepository.upsertDistrict({ id: district.id, name: district.name }),
    );
    return { kind: "ok", district };
  };
};
