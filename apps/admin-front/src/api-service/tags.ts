import type { CreateTagDto, TagResponseDto, UpdateTagDto } from "@repo/contracts";
import api from "./api";
import type { ListParams, Paginated } from "./types";

export async function listTags(params: ListParams): Promise<Paginated<TagResponseDto>> {
  const res = await api.get<Paginated<TagResponseDto>>("/tags", { params });
  return res.data;
}

export async function createTag(body: CreateTagDto): Promise<TagResponseDto> {
  const res = await api.post<TagResponseDto>("/tags", body);
  return res.data;
}

export async function updateTag(id: string, body: UpdateTagDto): Promise<TagResponseDto> {
  const res = await api.patch<TagResponseDto>(`/tags/${id}`, body);
  return res.data;
}

export async function deleteTag(id: string): Promise<void> {
  await api.delete(`/tags/${id}`);
}
