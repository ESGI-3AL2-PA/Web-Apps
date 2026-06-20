import type {
  PaginatedResponseDto,
  TagQueryDto,
  TagResponseDto,
  TagResponseDtoSchema,
} from "@repo/contracts";
import api from "./api";

type PaginatedTags = PaginatedResponseDto<typeof TagResponseDtoSchema>;

// Consigne USER : lecture seule sur les tags
//   - getTags() pour alimenter les <select> de filtres (FilterBar, formulaires)
//   - getTagById() pour une éventuelle page "explorer ce tag"
// Les écritures (create/update/delete) sont admin-only.

// GET /tags — paginated list, search optionnel
export async function getTags(
  filters: TagQueryDto = {} as TagQueryDto,
): Promise<PaginatedTags> {
  try {
    const res = await api.get<PaginatedTags>("/tags", { params: filters });
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Erreur lors du chargement des tags");
  }
}

// GET /tags/:id
export async function getTagById(id: string): Promise<TagResponseDto> {
  try {
    const res = await api.get<TagResponseDto>(`/tags/${id}`);
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Tag introuvable");
  }
}
