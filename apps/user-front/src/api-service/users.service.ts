import type { UpdateUserDto, UserResponseDto } from "@repo/contracts";

export async function getUserById(_id: string): Promise<UserResponseDto> {
  throw new Error("Not implemented");
}

export async function updateUser(_id: string, _data: UpdateUserDto): Promise<UserResponseDto> {
  throw new Error("Not implemented");
}

export async function deleteUser(_id: string): Promise<void> {
  throw new Error("Not implemented");
}
