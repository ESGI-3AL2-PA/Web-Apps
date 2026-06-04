import type { VoteResponseDto, VoteResultsResponseDto } from "@repo/contracts";
import api from "./api";
import type { ListParams, Paginated } from "./types";

export async function listVotes(params: ListParams): Promise<Paginated<VoteResponseDto>> {
  const res = await api.get<Paginated<VoteResponseDto>>("/votes", { params });
  return res.data;
}

export async function getVote(id: string): Promise<VoteResponseDto> {
  const res = await api.get<VoteResponseDto>(`/votes/${id}`);
  return res.data;
}

export async function getVoteResults(id: string): Promise<VoteResultsResponseDto> {
  const res = await api.get<VoteResultsResponseDto>(`/votes/${id}/results`);
  return res.data;
}

export async function deleteVote(id: string): Promise<void> {
  await api.delete(`/votes/${id}`);
}
