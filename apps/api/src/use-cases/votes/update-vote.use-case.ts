/**
 * Cas d'usage : mise à jour partielle d'un vote / sondage.
 *
 * Applique le patch, en garantissant l'invariant `endDate > startDate` lorsque l'une des
 * deux bornes change (l'autorisation et la validation de forme du corps sont assurées en
 * amont par le router/contrat).
 */
import type { Vote } from "../../entities/vote.entity.js";
import type { IVoteRepository } from "../../repositories/Vote/vote.repository.js";

// Levée lorsqu'un patch laisserait le vote avec endDate <= startDate. Le refine du DTO rejette
// déjà un patch portant les deux bornes ; ceci couvre le patch qui ne déplace qu'une seule
// borne au-delà de l'autre borne déjà stockée.
export class VoteDateRangeError extends Error {
  constructor(message = "endDate must be after startDate") {
    super(message);
    this.name = "VoteDateRangeError";
  }
}

/** Applique un patch partiel (hors `id`) au vote et retourne l'entité mise à jour, ou `null` si absente. */
export const updateVoteUseCase = (voteRepository: IVoteRepository) => {
  return async (id: string, data: Partial<Omit<Vote, "id">>): Promise<Vote | null> => {
    if (data.startDate !== undefined || data.endDate !== undefined) {
      const current = await voteRepository.getVoteById(id);
      if (!current) return null;
      const startDate = data.startDate ?? current.startDate;
      const endDate = data.endDate ?? current.endDate;
      if (new Date(endDate) <= new Date(startDate)) throw new VoteDateRangeError();
    }
    return await voteRepository.updateVote(id, data);
  };
};
