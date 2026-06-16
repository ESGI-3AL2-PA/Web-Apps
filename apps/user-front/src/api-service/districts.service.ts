import type {
  CreateDistrictDto,
  DistrictQueryDto,
  DistrictResponseDto,
  DistrictResponseDtoSchema,
  PaginatedResponseDto,
  UpdateDistrictDto,
} from "@repo/contracts";

type PaginatedDistricts = PaginatedResponseDto<typeof DistrictResponseDtoSchema>;

export async function getDistricts(
  _filters: DistrictQueryDto = {} as DistrictQueryDto,
): Promise<PaginatedDistricts> {
  throw new Error("Not implemented");
}

export async function getDistrictById(_id: string): Promise<DistrictResponseDto> {
  throw new Error("Not implemented");
}

export async function createDistrict(_data: CreateDistrictDto): Promise<DistrictResponseDto> {
  throw new Error("Not implemented");
}

export async function updateDistrict(_id: string, _data: UpdateDistrictDto): Promise<DistrictResponseDto> {
  throw new Error("Not implemented");
}

export async function deleteDistrict(_id: string): Promise<void> {
  throw new Error("Not implemented");
}
