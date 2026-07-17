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

export type UserPublic = { id: string; firstName: string; lastName: string };

// Cache local (promesses) pour ne pas re-fetch le même user à chaque cellule de tableau.
const publicCache = new Map<string, Promise<UserPublic>>();

// GET /users/:id/public — nom/prénom uniquement, accessible à tout admin authentifié.
export function getUserPublic(id: string): Promise<UserPublic> {
  const cached = publicCache.get(id);
  if (cached) return cached;
  const p = api
    .get<UserPublic>(`/users/${id}/public`)
    .then((res) => res.data)
    .catch((err) => {
      publicCache.delete(id);
      throw err;
    });
  publicCache.set(id, p);
  return p;
}

export async function updateUser(id: string, body: UpdateUserDto): Promise<UserResponseDto> {
  const res = await api.patch<UserResponseDto>(`/users/${id}`, body);
  return res.data;
}

export async function banUser(id: string, banned: boolean): Promise<UserResponseDto> {
  const res = await api.patch<UserResponseDto>(`/users/${id}/ban`, { banned });
  return res.data;
}

// Removes a regular user from their district, redistributing their points to the
// remaining members. Distinct from ban — the account stays active.
export async function kickFromDistrict(id: string): Promise<UserResponseDto> {
  const res = await api.post<UserResponseDto>(`/users/${id}/kick`, {});
  return res.data;
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
