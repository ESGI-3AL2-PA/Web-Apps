import type {
  CreateTagDto,
  PaginatedResponseDto,
  TagQueryDto,
  TagResponseDto,
  TagResponseDtoSchema,
  UpdateTagDto,
} from "@repo/contracts";

type PaginatedTags = PaginatedResponseDto<typeof TagResponseDtoSchema>;

export async function getTags(_filters: TagQueryDto = {} as TagQueryDto): Promise<PaginatedTags> {
  throw new Error("Not implemented");
}

export async function getTagById(_id: string): Promise<TagResponseDto> {
  throw new Error("Not implemented");
}

export async function createTag(_data: CreateTagDto): Promise<TagResponseDto> {
  throw new Error("Not implemented");
}

export async function updateTag(_id: string, _data: UpdateTagDto): Promise<TagResponseDto> {
  throw new Error("Not implemented");
}

export async function deleteTag(_id: string): Promise<void> {
  throw new Error("Not implemented");
}
