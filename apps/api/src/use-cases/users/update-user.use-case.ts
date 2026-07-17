import argon2 from "argon2";
import type { IUserRepository } from "../../repositories/User/user.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import type { IDistrictRepository } from "../../repositories/District/district.repository.js";
import type { ITransactionRepository } from "../../repositories/Transaction/transaction.repository.js";
import type { User } from "../../entities/user.entity.js";
import type { UpdateUserDto } from "@repo/contracts";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";
import { getCoordinatesFromAddress } from "../../services/address.service.js";
import { moveUserDistrict, type MembershipDeps } from "./district-membership.use-case.js";
import { logger } from "../../logger.js";

export type UpdateUserResult =
  | { kind: "ok"; user: User }
  | { kind: "not-found" }
  | { kind: "wrong-password" }
  | { kind: "email-conflict" };

// Mongo duplicate-key error code. The unique index on users.email is the real guard
// against two accounts sharing an address; a pre-check would still race a concurrent update.
const isDuplicateKeyError = (err: unknown): boolean =>
  typeof err === "object" && err !== null && "code" in err && (err as { code?: unknown }).code === 11000;

export const updateUserUseCase = (
  userRepository: IUserRepository,
  graphRepository: IGraphRepository,
  districtRepository: IDistrictRepository,
  transactionRepository: ITransactionRepository,
) => {
  return async (id: string, data: UpdateUserDto): Promise<UpdateUserResult> => {
    const { currentPassword, newPassword } = data;

    // Explicit allowlist — never let privileged fields (role, balance, emailVerified,
    // districtId, totpSecret) be set through this path from client input, even if the
    // DTO/validation changes. emailVerified is only ever forced to false server-side below.
    const update: Partial<Omit<User, "id" | "createdAt" | "updatedAt">> = {};
    if (data.firstName !== undefined) update.firstName = data.firstName;
    if (data.lastName !== undefined) update.lastName = data.lastName;
    if (data.email !== undefined) update.email = data.email;
    if (data.phone !== undefined) update.phone = data.phone;
    if (data.address !== undefined) update.address = data.address;
    if (data.lang !== undefined) update.lang = data.lang;

    // Need the current record to verify a password change, detect an email change, and
    // detect an address change (which re-resolves the user's district).
    const existing =
      newPassword || data.email !== undefined || data.address !== undefined
        ? await userRepository.getUserById(id)
        : null;

    if (newPassword) {
      if (!existing) return { kind: "not-found" };

      const valid = currentPassword ? await argon2.verify(existing.passwordHash, currentPassword) : false;
      if (!valid) return { kind: "wrong-password" };

      update.passwordHash = await argon2.hash(newPassword);
    }

    // Changing the email invalidates prior verification: force re-verification so a user
    // can't carry verified status onto an address they don't control. api owns the users
    // collection; auth-service gates login on emailVerified and exposes resendVerification.
    if (data.email !== undefined && existing && data.email !== existing.email) {
      update.emailVerified = false;
    }

    let updated: User | null;
    try {
      updated = await userRepository.updateUser(id, update);
    } catch (err) {
      // Lost the race to the unique email index (or a stale duplicate exists).
      if (isDuplicateKeyError(err)) return { kind: "email-conflict" };
      throw err;
    }
    if (!updated) return { kind: "not-found" };
    let user = updated;

    // Mirror to Neo4j if any of the projected attributes changed.
    if (update.firstName !== undefined || update.lastName !== undefined || update.email !== undefined) {
      await syncGraph(`upsertUser(${user.id})`, () =>
        graphRepository.upsertUser({
          id: user.id,
          name: `${user.firstName} ${user.lastName}`.trim(),
          email: user.email,
          role: user.role,
        }),
      );
    }

    // A changed address re-resolves the district. If the user still falls within their
    // current district, nothing changes. Otherwise this is a move: leave the old district
    // (redistributing points) and join the new one (granting its starting points) when
    // exactly one contains the new address; 0 (no coverage) or an overlap they can't be
    // auto-placed into leaves them district-less to re-onboard and pick. A geocoder
    // failure leaves membership untouched so a transient error can't silently eject them.
    if (data.address !== undefined && existing && data.address !== existing.address) {
      let matches: Awaited<ReturnType<typeof districtRepository.findDistrictsContaining>> | undefined;
      try {
        const coordinates = await getCoordinatesFromAddress(data.address);
        matches = await districtRepository.findDistrictsContaining(coordinates);
      } catch (err) {
        logger.error({ err, userId: id }, "update-user: address re-resolution failed — district unchanged");
      }
      if (matches !== undefined) {
        let newDistrictId: string | null;
        if (existing.districtId && matches.some((d) => d.id === existing.districtId)) {
          newDistrictId = existing.districtId; // still covered by the current district — no move
        } else if (matches.length === 1) {
          newDistrictId = matches[0]!.id;
        } else {
          newDistrictId = null; // no coverage, or overlap requiring a choice — become district-less
        }
        if (newDistrictId !== existing.districtId) {
          const deps: MembershipDeps = { userRepository, transactionRepository, districtRepository, graphRepository };
          const moved = await moveUserDistrict(deps, id, newDistrictId);
          if (moved) user = moved;
        }
      }
    }

    return { kind: "ok", user };
  };
};
