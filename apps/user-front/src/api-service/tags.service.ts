// Service API des tags (catégories d'annonces). Fine couche au-dessus du client axios
// `api` : appelle l'endpoint /tags et déballe la réponse paginée en simple tableau.
import type { PaginatedResponseDto, TagQueryDto, TagResponseDto, TagResponseDtoSchema } from "@repo/contracts";
import api from "./api";

type PaginatedTags = PaginatedResponseDto<typeof TagResponseDtoSchema>;

/**
 * GET /tags — récupère les catégories, limitées au quartier de l'appelant.
 * Alimente les puces/filtres de catégorie. La limite par défaut est portée à 100
 * pour tout charger d'un coup ; on ne renvoie que le tableau `data` de la pagination.
 */
export async function getTags(filters: TagQueryDto = {} as TagQueryDto): Promise<TagResponseDto[]> {
  const res = await api.get<PaginatedTags>("/tags", { params: { ...filters, limit: filters.limit ?? 100 } });
  return res.data.data;
}
