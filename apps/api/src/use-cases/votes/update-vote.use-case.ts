/**
 * Cas d'usage : mise à jour partielle d'un vote / sondage.
 *
 * Simple pass-through vers le repository : passe le patch tel quel, sans logique métier
 * (l'autorisation et la validation du corps sont assurées en amont par le router/contrat).
 */
import type { Vote } from "../../entities/vote.entity.js";
import type { IVoteRepository } from "../../repositories/Vote/vote.repository.js";

/** Applique un patch partiel (hors `id`) au vote et retourne l'entité mise à jour, ou `null` si absente. */
export const updateVoteUseCase = (voteRepository: IVoteRepository) => {
  return async (id: string, data: Partial<Omit<Vote, "id">>): Promise<Vote | null> => {
    return await voteRepository.updateVote(id, data);
  };
};
