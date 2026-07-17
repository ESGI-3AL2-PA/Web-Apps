import type { District } from "../../entities/district.entity.js";
import type { User } from "../../entities/user.entity.js";
import { getCoordinatesFromAddress } from "../../services/address.service.js";
import { logger } from "../../logger.js";
import { joinDistrict, type MembershipDeps } from "./district-membership.use-case.js";

type ResolveResult = { resolved: boolean; user?: User; candidates: District[] };

// Re-geocodes the caller's stored address and joins the containing district. Idempotent:
// a user who already has a district is returned unchanged.
// - exactly one district contains the address => join it
// - several contain it => return them as `candidates` (no join) unless the caller passes
//   a `chosenDistrictId` that is one of them
// - none contain it => resolved:false, empty candidates
export const resolveMyDistrictUseCase = (deps: MembershipDeps) => {
  return async (userId: string, chosenDistrictId?: string): Promise<ResolveResult> => {
    const user = await deps.userRepository.getUserById(userId);
    if (!user) return { resolved: false, candidates: [] };
    if (user.districtId) return { resolved: true, user, candidates: [] };

    let matches: District[] = [];
    try {
      const coordinates = await getCoordinatesFromAddress(user.address);
      matches = await deps.districtRepository.findDistrictsContaining(coordinates);
    } catch (err) {
      logger.error({ err, userId }, "resolve-my-district: geocode/lookup failed");
      return { resolved: false, candidates: [] };
    }

    if (matches.length === 0) return { resolved: false, candidates: [] };

    let target: District | undefined;
    if (chosenDistrictId) {
      target = matches.find((d) => d.id === chosenDistrictId);
      if (!target) return { resolved: false, candidates: matches }; // invalid choice — re-present
    } else if (matches.length === 1) {
      target = matches[0];
    } else {
      return { resolved: false, candidates: matches }; // overlap — the user must choose
    }

    const joined = await joinDistrict(deps, userId, target!.id);
    return joined ? { resolved: true, user: joined, candidates: [] } : { resolved: false, candidates: [] };
  };
};
