import type { ClientSession } from "mongodb";
import type { Vote, VoteResponseEntity } from "../../entities/vote.entity.js";

/**
 * Contrat du repository des votes / sondages (couche repository).
 *
 * Deux collections sous le capot : les votes et leurs réponses. L'interface
 * couvre la liste paginée enrichie de l'état de vote de l'appelant, le CRUD du
 * vote, la soumission/annulation de réponses (avec entretien des compteurs de
 * résultats mis en cache) et l'agrégation des résultats. Les écritures liées à
 * l'attribution de points acceptent une `ClientSession` pour rester atomiques.
 */
export interface IVoteRepository {
  ensureIndexes(): Promise<void>;

  // Liste paginée, filtrable par recherche/statut/quartier/créateur ; `currentUserId` enrichit chaque vote de l'état de l'appelant.
  getVotes(params: {
    search?: string;
    status?: string;
    districtId?: string;
    creatorId?: string;
    currentUserId?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    data: Vote[];
    total: number;
    page: number;
    limit: number;
  }>;
  getVoteById(id: string, currentUserId?: string): Promise<Vote | null>;

  createVote(data: Omit<Vote, "id" | "results">): Promise<Vote>;

  updateVote(id: string, data: Partial<Omit<Vote, "id">>): Promise<Vote | null>;

  deleteVote(id: string): Promise<boolean>;

  // Enregistre une réponse et incrémente le compteur de l'option choisie.
  submitResponse(
    data: Omit<VoteResponseEntity, "id" | "votedAt">,
    session?: ClientSession,
  ): Promise<VoteResponseEntity>;

  // Retire les réponses d'un utilisateur sur un vote donné (et décrémente les compteurs) ; renvoie les options retirées.
  clearUserResponses(voteId: string, userId: string, session?: ClientSession): Promise<string[]>;

  /** Supprime toutes les réponses de vote d'un utilisateur, tous votes confondus (suppression de compte). */
  deleteUserResponses(userId: string): Promise<void>;

  // Agrège les résultats bruts (comptage par option) directement depuis les réponses.
  getResults(voteId: string): Promise<{ totalResponses: number; results: { option: string; count: number }[] }>;

  hasUserVoted(voteId: string, userId: string): Promise<boolean>;
}
