import argon2 from "argon2";
import type { IUserRepository } from "../../repositories/User/user.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import type { User } from "../../entities/user.entity.js";
import type { UpdateUserDto } from "@repo/contracts";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";

export type UpdateUserResult =
  | { kind: "ok"; user: User }
  | { kind: "not-found" }
  | { kind: "wrong-password" }
  | { kind: "email-conflict" };

// Mongo duplicate-key error code. The unique index on users.email is the real guard
// against two accounts sharing an address; a pre-check would still race a concurrent update.
const isDuplicateKeyError = (err: unknown): boolean =>
  typeof err === "object" && err !== null && "code" in err && (err as { code?: unknown }).code === 11000;

export const updateUserUseCase = (userRepository: IUserRepository, graphRepository: IGraphRepository) => {
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

    // Need the current record to verify a password change and to detect an email change.
    const existing = newPassword || data.email !== undefined ? await userRepository.getUserById(id) : null;

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
    const user = updated;

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

    return { kind: "ok", user };
  };
};
