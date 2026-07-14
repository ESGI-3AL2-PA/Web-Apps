import type { PaginatedResponseDto, TagQueryDto, TagResponseDto, TagResponseDtoSchema } from "@repo/contracts";
import api from "./api";

type PaginatedTags = PaginatedResponseDto<typeof TagResponseDtoSchema>;

// GET /tags — categories, district-scoped. Used to drive the category chips/filter.
export async function getTags(filters: TagQueryDto = {} as TagQueryDto): Promise<TagResponseDto[]> {
  const res = await api.get<PaginatedTags>("/tags", { params: { ...filters, limit: filters.limit ?? 100 } });
  return res.data.data;
}
