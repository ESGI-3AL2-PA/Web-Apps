import type { CreateDistrictAdminDto, DistrictAdminResponseDto } from "@repo/contracts";
import type { IDistrictAdminRepository } from "../../repositories/DistrictAdmin/district-admin.repository.js";
import { joinDistrict, type MembershipDeps } from "../users/district-membership.use-case.js";

// Signals the router that the (districtId, userId) pair already exists.
// The router translates this to a 409 Conflict response.
export class DistrictAdminAlreadyExistsError extends Error {
  constructor() {
    super("This user is already an admin of this district");
    this.name = "DistrictAdminAlreadyExistsError";
  }
}

// Mongo duplicate-key error code. The unique (districtId, userId) index is the real
// guard; findExisting below is only a fast pre-check a concurrent insert can race past.
const isDuplicateKeyError = (err: unknown): boolean =>
  typeof err === "object" && err !== null && "code" in err && (err as { code?: unknown }).code === 11000;

export const createDistrictAdminUseCase = (repo: IDistrictAdminRepository, deps: MembershipDeps) => {
  return async (data: CreateDistrictAdminDto): Promise<DistrictAdminResponseDto> => {
    const existing = await repo.findExisting(data.districtId, data.userId);
    if (existing) throw new DistrictAdminAlreadyExistsError();
    let created: DistrictAdminResponseDto;
    try {
      created = await repo.createDistrictAdmin(data);
    } catch (err) {
      // Lost the race to the unique index — surface the same 409 conflict
      // instead of letting an undeclared 500 escape.
      if (isDuplicateKeyError(err)) throw new DistrictAdminAlreadyExistsError();
      throw err;
    }
    // The JWT role is minted from the user record at login, and adminDistrictId is
    // only resolved for role "admin" — so the assignment row alone grants nothing.
    // Promote a plain resident; leave a superAdmin (global) untouched.
    const user = await deps.userRepository.getUserById(data.userId);
    if (user?.role === "user") {
      await deps.userRepository.updateUser(data.userId, { role: "admin" });
    }
    // Invariant: a non-superAdmin admin must reside in the district they administer.
    // A district-less promotee (empty districtId) is joined to it here — setting the
    // residence and granting the district's starting points through the ledger. An
    // existing resident keeps their district (the invariant only forbids empty), and a
    // superAdmin (global) is exempt — they may stay district-less.
    if (user && user.role !== "superAdmin" && !user.districtId) {
      await joinDistrict(deps, data.userId, data.districtId);
    }
    return created;
  };
};
