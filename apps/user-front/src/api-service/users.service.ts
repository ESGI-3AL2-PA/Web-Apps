import type {
  CreateUserDto,
  PaginatedResponseDto,
  UpdateUserDto,
  UserQueryDto,
  UserResponseDto,
} from "@repo/contracts";
import type { UserResponseDtoSchema } from "@repo/contracts";

// `PaginatedResponseDto` is generic over a Zod schema — the concrete shape
// inferred here matches what /users returns.
type PaginatedUsers = PaginatedResponseDto<typeof UserResponseDtoSchema>;

export async function getUsers(_filters: UserQueryDto = {} as UserQueryDto): Promise<PaginatedUsers> {
  throw new Error("Not implemented");
}

export async function getUserById(_id: string): Promise<UserResponseDto> {
  throw new Error("Not implemented");
}

export async function createUser(_data: CreateUserDto): Promise<UserResponseDto> {
  throw new Error("Not implemented");
}

export async function updateUser(_id: string, _data: UpdateUserDto): Promise<UserResponseDto> {
  throw new Error("Not implemented");
}

export async function deleteUser(_id: string): Promise<void> {
  throw new Error("Not implemented");
}
