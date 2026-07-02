import type { IUserRepository } from "../../repositories/User/user.repository.js";
import type { User } from "../../entities/user.entity.js";

type BanResult = { kind: "ok"; user: User } | { kind: "not-found" } | { kind: "forbidden" };

// Bans/unbans a user. Only regular `user` accounts can be banned — never admins or superAdmins.
export const banUserUseCase = (userRepository: IUserRepository) => {
  return async (id: string, banned: boolean): Promise<BanResult> => {
    const target = await userRepository.getUserById(id);
    if (!target) return { kind: "not-found" };
    if (target.role !== "user") return { kind: "forbidden" };

    const updated = await userRepository.setBanned(id, banned);
    if (!updated) return { kind: "not-found" };
    return { kind: "ok", user: updated };
  };
};
