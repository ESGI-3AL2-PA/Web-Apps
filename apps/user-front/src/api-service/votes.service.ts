import type {
  CreateVoteDto,
  PaginatedResponseDto,
  SubmitVoteResponseDto,
  VoteQueryInput,
  VoteResponseDto,
  VoteResponseDtoSchema,
} from "@repo/contracts";
import api from "./api";

// Service API des votes/sondages de quartier.
type PaginatedVotes = PaginatedResponseDto<typeof VoteResponseDtoSchema>;

/** GET /votes — sondages du quartier de l'appelant. Limite par défaut à 50, on ne renvoie que le tableau. */
export async function getVotes(filters: VoteQueryInput = {}): Promise<VoteResponseDto[]> {
  const res = await api.get<PaginatedVotes>("/votes", { params: { ...filters, limit: filters.limit ?? 50 } });
  return res.data.data;
}

/** POST /votes — crée un sondage dans le quartier de l'appelant (le serveur force le statut "draft"). */
export async function createVote(body: CreateVoteDto): Promise<VoteResponseDto> {
  const res = await api.post<VoteResponseDto>("/votes", body);
  return res.data;
}

/** GET /votes/:id — un sondage (résultats dévoilés si l'utilisateur a voté ou si le sondage est clos). */
export async function getVoteById(id: string): Promise<VoteResponseDto> {
  const res = await api.get<VoteResponseDto>(`/votes/${id}`);
  return res.data;
}

/**
 * POST /votes/:id/responses — enregistre le vote de l'utilisateur, puis re-fetch le
 * sondage : voter dévoile les résultats, on renvoie donc la version à jour.
 */
export async function submitVote(id: string, data: SubmitVoteResponseDto): Promise<VoteResponseDto> {
  await api.post(`/votes/${id}/responses`, data);
  return getVoteById(id);
}
