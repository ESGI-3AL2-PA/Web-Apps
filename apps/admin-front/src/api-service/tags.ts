// Couche api-service : wrappers axios autour des endpoints tags de l'api (CRUD complet).
import type { CreateTagDto, TagResponseDto, UpdateTagDto } from "@repo/contracts";
import api from "./api";
import type { ListParams, Paginated } from "./types";

/** GET /tags — liste paginée des tags. */
export async function listTags(params: ListParams): Promise<Paginated<TagResponseDto>> {
  const res = await api.get<Paginated<TagResponseDto>>("/tags", { params });
  return res.data;
}

/** POST /tags — crée un tag. */
export async function createTag(body: CreateTagDto): Promise<TagResponseDto> {
  const res = await api.post<TagResponseDto>("/tags", body);
  return res.data;
}

/** PATCH /tags/:id — met à jour un tag. */
export async function updateTag(id: string, body: UpdateTagDto): Promise<TagResponseDto> {
  const res = await api.patch<TagResponseDto>(`/tags/${id}`, body);
  return res.data;
}

/** DELETE /tags/:id — supprime un tag. */
export async function deleteTag(id: string): Promise<void> {
  await api.delete(`/tags/${id}`);
}
