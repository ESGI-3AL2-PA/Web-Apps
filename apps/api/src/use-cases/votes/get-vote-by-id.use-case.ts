import type { IVoteRepository } from "../../repositories/Vote/vote.repository.js";

/**
 * Cas d'usage (domaine votes) : récupère un vote / sondage par son id.
 * `currentUserId` (optionnel) permet au repository d'enrichir la réponse avec la propre
 * réponse de l'appelant. Renvoie `null` si le vote est introuvable.
 */
export const getVoteByIdUseCase = (voteRepository: IVoteRepository) => {
  return async (params: { id: string; currentUserId?: string }) => {
    return await voteRepository.getVoteById(params.id, params.currentUserId);
  };
};
