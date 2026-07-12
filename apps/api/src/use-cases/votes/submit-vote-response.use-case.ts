import type { SubmitVoteResponseDto } from "@repo/contracts";
import type { Vote } from "../../entities/vote.entity.js";
import type { IVoteRepository } from "../../repositories/Vote/vote.repository.js";
import type { IUserRepository } from "../../repositories/User/user.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";
import { runInTransaction } from "../../repositories/tx.js";

export class InvalidVoteSubmissionError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "InvalidVoteSubmissionError";
  }
}

export class VoteDistrictForbiddenError extends Error {
  constructor() {
    super("Vous ne pouvez voter que sur un scrutin concernant votre quartier");
    this.name = "VoteDistrictForbiddenError";
  }
}

export const submitVoteResponseUseCase = (
  voteRepository: IVoteRepository,
  graphRepository: IGraphRepository,
  userRepository: IUserRepository,
) => {
  return async (voteId: string, userId: string, data: SubmitVoteResponseDto): Promise<{ vote: Vote | null }> => {
    const vote = await voteRepository.getVoteById(voteId, userId);
    if (!vote) return { vote: null };

    // Contrôle d'appartenance : un votant ne peut se prononcer que sur un scrutin
    // concernant SON quartier de résidence — sans ça, n'importe quel utilisateur
    // pourrait bourrer les urnes d'un autre quartier. superAdmin excepté. Le quartier
    // de résidence n'est pas dans le JWT (seul adminDistrictId l'est), d'où le load.
    const caller = await userRepository.getUserById(userId);
    if (!caller || (caller.role !== "superAdmin" && !vote.districtIds.includes(caller.districtId))) {
      throw new VoteDistrictForbiddenError();
    }

    // Le garde-fou de statut/deadline vit ici et non côté client : un POST direct
    // ne doit pas pouvoir voter sur un vote draft, clos ou dont la date est dépassée.
    if (vote.status !== "open") {
      throw new InvalidVoteSubmissionError("Ce vote n'est pas ouvert");
    }
    if (new Date(vote.endDate).getTime() < Date.now()) {
      throw new InvalidVoteSubmissionError("La date limite de ce vote est dépassée");
    }

    // Dédoublonnage : sans ça, `chosenOptions: ["A","A"]` incrémenterait "A" plusieurs fois.
    const incomingOptions: string[] = [
      ...new Set(
        data.chosenOptions && data.chosenOptions.length > 0
          ? data.chosenOptions
          : data.chosenOption
            ? [data.chosenOption]
            : [],
      ),
    ];

    if (incomingOptions.length === 0) {
      throw new InvalidVoteSubmissionError("Au moins une option requise");
    }
    if (vote.voteType === "single_choice" && incomingOptions.length > 1) {
      throw new InvalidVoteSubmissionError("Le vote single_choice n'accepte qu'une seule option");
    }
    for (const opt of incomingOptions) {
      if (!vote.options.includes(opt)) {
        throw new InvalidVoteSubmissionError(`Option invalide: "${opt}"`);
      }
    }
    // Remplacer le bulletin précédent doit être atomique : sans transaction, un
    // échec entre le clear et la ré-insertion effacerait le vote antérieur sans
    // rien réenregistrer. Sur Mongo standalone (dev), runInTransaction retombe en
    // séquentiel — même risque résiduel qu'avant, mais atomique en réplica-set.
    await runInTransaction(async (session) => {
      await voteRepository.clearUserResponses(voteId, userId, session);
      for (const option of incomingOptions) {
        await voteRepository.submitResponse({ voteId, userId, chosenOption: option }, session);
      }
    });

    const now = new Date().toISOString();
    for (const option of incomingOptions) {
      await syncGraph(`linkUserVoted(${userId}->${voteId}:${option})`, () =>
        graphRepository.linkUserVoted(userId, voteId, option, now),
      );
    }

    const refreshed = await voteRepository.getVoteById(voteId, userId);
    return { vote: refreshed };
  };
};
