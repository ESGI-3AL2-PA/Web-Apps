import type { UserResponseDto, UpdateUserDto } from "@repo/contracts";
import api from "./api";
import type { ListParams, Paginated } from "./types";

export async function listUsers(params: ListParams): Promise<Paginated<UserResponseDto>> {
  const res = await api.get<Paginated<UserResponseDto>>("/users", { params });
  return res.data;
}

export async function getUser(id: string): Promise<UserResponseDto> {
  const res = await api.get<UserResponseDto>(`/users/${id}`);
  return res.data;
}

export async function updateUser(id: string, body: UpdateUserDto): Promise<UserResponseDto> {
  const res = await api.patch<UserResponseDto>(`/users/${id}`, body);
  return res.data;
}

export async function deleteUser(id: string): Promise<void> {
  await api.delete(`/users/${id}`);
}
