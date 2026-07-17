import type { User } from "../../entities/user.entity.js";
import { leaveDistrict, type MembershipDeps } from "./district-membership.use-case.js";

type KickResult = { kind: "ok"; user: User } | { kind: "not-found" } | { kind: "forbidden" };

// Kicks a regular user out of their district, redistributing their points to the
// remaining members. Only `user` accounts can be kicked — never admins/superAdmins.
// Distinct from ban: it does not touch `banned`, only district membership + points.
export const kickFromDistrictUseCase = (deps: MembershipDeps) => {
  return async (id: string): Promise<KickResult> => {
    const target = await deps.userRepository.getUserById(id);
    if (!target) return { kind: "not-found" };
    if (target.role !== "user") return { kind: "forbidden" };
    if (!target.districtId) return { kind: "ok", user: target }; // already district-less

    const updated = await leaveDistrict(deps, id);
    if (!updated) return { kind: "not-found" };
    return { kind: "ok", user: updated };
  };
};
