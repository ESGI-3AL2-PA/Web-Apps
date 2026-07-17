import type { District } from "../../entities/district.entity.js";
import type { IDistrictRepository, UpdateDistrictData } from "../../repositories/District/district.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import type { IUserRepository } from "../../repositories/User/user.repository.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";
import { checkMembersWithinPolygon } from "./check-members-within-polygon.use-case.js";

export type UpdateDistrictResult =
  | { kind: "ok"; district: District }
  | { kind: "not-found" }
  | { kind: "members-outside"; outside: { id: string; address: string }[] };

export const updateDistrictUseCase = (
  districtRepository: IDistrictRepository,
  graphRepository: IGraphRepository,
  userRepository: IUserRepository,
) => {
  return async (id: string, data: UpdateDistrictData): Promise<UpdateDistrictResult> => {
    // Guard: a boundary change must not leave existing members outside the district.
    // (geoJson null clears the boundary — nothing to validate against.)
    if (data.geoJson) {
      const outside = await checkMembersWithinPolygon(userRepository, id, data.geoJson);
      if (outside.length > 0) return { kind: "members-outside", outside };
    }

    const district = await districtRepository.updateDistrict(id, data);
    if (!district) return { kind: "not-found" };
    if (data.name !== undefined) {
      await syncGraph(`upsertDistrict(${district.id})`, () =>
        graphRepository.upsertDistrict({ id: district.id, name: district.name }),
      );
    }
    return { kind: "ok", district };
  };
};
