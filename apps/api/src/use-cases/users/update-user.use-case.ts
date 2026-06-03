import argon2 from "argon2";
import type { IUserRepository } from "../../repositories/User/user.repository.js";
import type { User } from "../../entities/user.entity.js";
import type { UpdateUserDto } from "@repo/contracts";

export type UpdateUserResult = { kind: "ok"; user: User } | { kind: "not-found" } | { kind: "wrong-password" };

export const updateUserUseCase = (userRepository: IUserRepository) => {
  return async (id: string, data: UpdateUserDto): Promise<UpdateUserResult> => {
    const { currentPassword, newPassword } = data;

    // Explicit allowlist — never let privileged fields (role, balance, emailVerified,
    // districtId, totpSecret) be set through this path, even if the DTO/validation changes.
    const update: Partial<Omit<User, "id" | "createdAt" | "updatedAt">> = {};
    if (data.firstName !== undefined) update.firstName = data.firstName;
    if (data.lastName !== undefined) update.lastName = data.lastName;
    if (data.email !== undefined) update.email = data.email;
    if (data.phone !== undefined) update.phone = data.phone;
    if (data.address !== undefined) update.address = data.address;

    if (newPassword) {
      const existing = await userRepository.getUserById(id);
      if (!existing) return { kind: "not-found" };

      const valid = currentPassword ? await argon2.verify(existing.passwordHash, currentPassword) : false;
      if (!valid) return { kind: "wrong-password" };

      update.passwordHash = await argon2.hash(newPassword);
    }

    const user = await userRepository.updateUser(id, update);
    if (!user) return { kind: "not-found" };
    return { kind: "ok", user };
  };
};
