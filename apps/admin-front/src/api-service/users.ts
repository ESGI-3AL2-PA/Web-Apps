import type { UserResponseDto, UpdateUserDto } from "@repo/contracts";
import { config } from "@repo/config";
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

export async function banUser(id: string, banned: boolean): Promise<UserResponseDto> {
  const res = await api.patch<UserResponseDto>(`/users/${id}/ban`, { banned });
  return res.data;
}

export async function deleteUser(id: string): Promise<void> {
  await api.delete(`/users/${id}`);
}

// Triggers the auth-service's password-reset email flow for a stuck user. Public endpoint (always
// 200, no enumeration); the admin already has the email from the users table.
export async function requestPasswordReset(email: string): Promise<void> {
  await fetch(`${config.authServiceUrl}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}
