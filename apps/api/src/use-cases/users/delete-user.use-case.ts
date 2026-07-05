import type { IUserRepository } from "../../repositories/User/user.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";

export const deleteUserUseCase = (userRepository: IUserRepository, graphRepository: IGraphRepository) => {
  return async (params: { id: string }): Promise<boolean> => {
    const deleted = await userRepository.deleteUser(params.id);
    if (deleted) {
      // DETACH DELETE in Neo4j removes all the user's relationships too.
      await syncGraph(`deleteUser(${params.id})`, () => graphRepository.deleteUser(params.id));
    }
    return deleted;
  };
};
