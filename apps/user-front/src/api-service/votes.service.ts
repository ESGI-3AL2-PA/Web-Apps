import type {
  PaginatedResponseDto,
  SubmitVoteResponseDto,
  VoteQueryDto,
  VoteResponseDto,
  VoteResponseDtoSchema,
  VoteResultsResponseDto,
} from "@repo/contracts";
import api from "./api";

type PaginatedVotes = PaginatedResponseDto<typeof VoteResponseDtoSchema>;

// GET /votes — paginated list with optional filters
// (search, status, districtId, creatorId, page, limit)
export async function getVotes(filters: VoteQueryDto = {} as VoteQueryDto): Promise<PaginatedVotes> {
  try {
    const res = await api.get<PaginatedVotes>("/votes", { params: filters });
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Erreur lors du get all votes");
  }
}

// GET /votes/:id — single vote (includes cached `results` aggregate)
export async function getVoteById(id: string): Promise<VoteResponseDto> {
  try {
    const res = await api.get<VoteResponseDto>(`/votes/${id}`);
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Vote introuvable");
  }
}

// GET /votes/:id/results — fresh aggregation from vote_responses (option → count)
export async function getVoteResults(id: string): Promise<VoteResultsResponseDto> {
  try {
    const res = await api.get<VoteResultsResponseDto>(`/votes/${id}/results`);
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Erreur lors de la récupération des résultats du vote");
  }
}

// POST /votes/:id/responses — cast a vote (idempotent on the user, alreadyVoted handled server-side)
export async function submitVoteResponse(id: string, data: SubmitVoteResponseDto): Promise<VoteResponseDto> {
  try {
    const res = await api.post<VoteResponseDto>(`/votes/${id}/responses`, data);
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Erreur lors de l'envoi du vote");
  }
}
