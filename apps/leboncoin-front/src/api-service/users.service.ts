import type { UpdateUserDto, UserResponseDto } from "@repo/contracts";
import api from "./api";

export type UserPublic = { id: string; firstName: string; lastName: string };

// GET /users/:id — full profile (self or admin).
export async function getUserById(id: string): Promise<UserResponseDto> {
  const res = await api.get<UserResponseDto>(`/users/${id}`);
  return res.data;
}

// PATCH /users/:id — update editable profile fields (self or admin).
export async function updateUser(id: string, data: UpdateUserDto): Promise<UserResponseDto> {
  const res = await api.patch<UserResponseDto>(`/users/${id}`, data);
  return res.data;
}

// GET /users/public/search?q= — search neighbours by name, scoped to the caller's district.
export async function searchUsersPublic(q: string): Promise<UserPublic[]> {
  const res = await api.get<UserPublic[]>("/users/public/search", { params: { q } });
  return res.data ?? [];
}

// GET /users/:id/public — minimal public profile (name), any authenticated user.
const publicCache = new Map<string, Promise<UserPublic>>();

export async function getUserPublic(id: string): Promise<UserPublic> {
  const cached = publicCache.get(id);
  if (cached) return cached;
  const p = (async () => {
    try {
      const res = await api.get<UserPublic>(`/users/${id}/public`);
      return res.data;
    } catch (err) {
      publicCache.delete(id);
      throw err;
    }
  })();
  publicCache.set(id, p);
  return p;
}
