import type { UpdateUserDto, UserResponseDto } from "@repo/contracts";
import api from "./api";

// GET /users/:id — self or admin (backend `authorize` vérifie via `selfParam`)
export async function getUserById(id: string): Promise<UserResponseDto> {
  try {
    const res = await api.get<UserResponseDto>(`/users/${id}`);
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Utilisateur introuvable");
  }
}

export type UserPublic = { id: string; firstName: string; lastName: string };

// Cache local pour éviter de re-fetch le même user plusieurs fois (sidebar messagerie).
const publicCache = new Map<string, Promise<UserPublic>>();

// GET /users/:id/public — infos minimales (nom/prénom), accessibles à tout user authentifié.
export async function getUserPublic(id: string): Promise<UserPublic> {
  const cached = publicCache.get(id);
  if (cached) return cached;
  const p = (async () => {
    try {
      const res = await api.get<UserPublic>(`/users/${id}/public`);
      if (!res.data) throw new Error();
      return res.data;
    } catch {
      publicCache.delete(id);
      throw new Error("Profil public introuvable");
    }
  })();
  publicCache.set(id, p);
  return p;
}

// PATCH /users/:id — self or admin
export async function updateUser(id: string, data: UpdateUserDto): Promise<UserResponseDto> {
  try {
    const res = await api.patch<UserResponseDto>(`/users/${id}`, data);
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Erreur lors de la mise à jour de l'utilisateur");
  }
}

// DELETE /users/:id — self (RGPD) ou admin
export async function deleteUser(id: string): Promise<void> {
  try {
    await api.delete(`/users/${id}`);
  } catch {
    throw new Error("Erreur lors de la suppression de l'utilisateur");
  }
}
