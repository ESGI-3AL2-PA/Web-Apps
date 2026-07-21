import type {
  CreateVoteDto,
  PaginatedResponseDto,
  SubmitVoteResponseDto,
  VoteQueryInput,
  VoteResponseDto,
  VoteResponseDtoSchema,
} from "@repo/contracts";
import api from "./api";

type PaginatedVotes = PaginatedResponseDto<typeof VoteResponseDtoSchema>;

// GET /votes — neighbourhood polls, district-scoped
export async function getVotes(filters: VoteQueryInput = {}): Promise<VoteResponseDto[]> {
  const res = await api.get<PaginatedVotes>("/votes", { params: { ...filters, limit: filters.limit ?? 50 } });
  return res.data.data;
}

// POST /votes — create a poll in the caller's district (server forces status "draft")
export async function createVote(body: CreateVoteDto): Promise<VoteResponseDto> {
  const res = await api.post<VoteResponseDto>("/votes", body);
  return res.data;
}

// GET /votes/:id — single poll (with results revealed if the user has voted / it is closed)
export async function getVoteById(id: string): Promise<VoteResponseDto> {
  const res = await api.get<VoteResponseDto>(`/votes/${id}`);
  return res.data;
}

// POST /votes/:id/responses — cast a vote; the backend returns the poll with results now revealed
export async function submitVote(id: string, data: SubmitVoteResponseDto): Promise<VoteResponseDto> {
  await api.post(`/votes/${id}/responses`, data);
  return getVoteById(id);
}
