import type { IUserRepository } from "../../repositories/User/user.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";

// Raised when a deletion targets a superAdmin account. superAdmins are the global
// break-glass operators; allowing their account to be removed (even by themselves)
// risks locking the whole platform out of administration, so it is never permitted.
export class CannotDeleteSuperAdminError extends Error {
  constructor() {
    super("superAdmin accounts cannot be deleted");
    this.name = "CannotDeleteSuperAdminError";
  }
}

// Self-service account deletion (the route scopes this to the caller's own id). The
// superAdmin guardrail is enforced here too, defence-in-depth, so it holds regardless
// of how the route is scoped. Returns false if the user no longer exists.
export const deleteUserUseCase = (userRepository: IUserRepository, graphRepository: IGraphRepository) => {
  return async (params: { id: string }): Promise<boolean> => {
    const user = await userRepository.getUserById(params.id);
    if (!user) return false;
    if (user.role === "superAdmin") throw new CannotDeleteSuperAdminError();
    const deleted = await userRepository.deleteUser(params.id);
    if (deleted) {
      // DETACH DELETE in Neo4j removes all the user's relationships too.
      await syncGraph(`deleteUser(${params.id})`, () => graphRepository.deleteUser(params.id));
    }
    return deleted;
  };
};
