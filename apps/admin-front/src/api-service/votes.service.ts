import type {
  CreateVoteDto,
  PaginatedResponseDto,
  UpdateVoteDto,
  VoteQueryDto,
  VoteResponseDto,
  VoteResponseDtoSchema,
  VoteResultsResponseDto,
} from "@repo/contracts";
import api from "./api";

type PaginatedVotes = PaginatedResponseDto<typeof VoteResponseDtoSchema>;

// Consigne ADMIN — VOTES: full CRUD (l'admin crée et gère les votes du quartier)
// (Pas de submitVoteResponse — réservé à l'user-front)

// GET /votes — paginated list (filtres: search, status, districtId, …)
export async function getVotes(
  filters: VoteQueryDto = {} as VoteQueryDto,
): Promise<PaginatedVotes> {
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

// GET /votes/:id
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

// GET /votes/:id/results — agrégat option → count
export async function getVoteResults(id: string): Promise<VoteResultsResponseDto> {
  try {
    const res = await api.get<VoteResultsResponseDto>(`/votes/${id}/results`);
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Erreur lors de la récupération des résultats");
  }
}

// POST /votes — l'admin lance un nouveau vote
export async function createVote(data: CreateVoteDto): Promise<VoteResponseDto> {
  try {
    const res = await api.post<VoteResponseDto>("/votes", data);
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Erreur lors de la création du vote");
  }
}

// PATCH /votes/:id — clore un vote, modifier la deadline, …
export async function updateVote(id: string, data: UpdateVoteDto): Promise<VoteResponseDto> {
  try {
    const res = await api.patch<VoteResponseDto>(`/votes/${id}`, data);
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Erreur lors de la mise à jour du vote");
  }
}

// DELETE /votes/:id
export async function deleteVote(id: string): Promise<void> {
  try {
    await api.delete(`/votes/${id}`);
  } catch {
    throw new Error("Erreur lors de la suppression du vote");
  }
}
