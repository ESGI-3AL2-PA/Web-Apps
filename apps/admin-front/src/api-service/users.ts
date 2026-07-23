// Couche api-service : wrappers axios autour des endpoints utilisateurs (liste, détail, mise à jour,
// bannissement, exclusion de quartier, réinitialisation de mot de passe).
import type { UserResponseDto, UpdateUserDto } from "@repo/contracts";
import { config } from "@repo/config";
import api from "./api";
import type { ListParams, Paginated } from "./types";

/** GET /users — liste paginée des utilisateurs. */
export async function listUsers(params: ListParams): Promise<Paginated<UserResponseDto>> {
  const res = await api.get<Paginated<UserResponseDto>>("/users", { params });
  return res.data;
}

/** GET /users/:id — détail complet d'un utilisateur. */
export async function getUser(id: string): Promise<UserResponseDto> {
  const res = await api.get<UserResponseDto>(`/users/${id}`);
  return res.data;
}

/** Projection publique minimale d'un utilisateur (identité seulement). */
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

/** PATCH /users/:id — met à jour un utilisateur. */
export async function updateUser(id: string, body: UpdateUserDto): Promise<UserResponseDto> {
  const res = await api.patch<UserResponseDto>(`/users/${id}`, body);
  return res.data;
}

/** PATCH /users/:id/ban — bannit ou débannit un utilisateur selon `banned`. */
export async function banUser(id: string, banned: boolean): Promise<UserResponseDto> {
  const res = await api.patch<UserResponseDto>(`/users/${id}/ban`, { banned });
  return res.data;
}

/**
 * POST /users/:id/kick — retire un utilisateur standard de son quartier ; le traitement de son
 * solde de points est décidé côté api. À distinguer du bannissement : le compte reste actif.
 */
export async function kickFromDistrict(id: string): Promise<UserResponseDto> {
  const res = await api.post<UserResponseDto>(`/users/${id}/kick`, {});
  return res.data;
}

/**
 * Déclenche le flux d'email de réinitialisation de mot de passe de l'auth-service pour un
 * utilisateur bloqué. Endpoint public (répond toujours 200, pas d'énumération) ; l'admin
 * dispose déjà de l'email depuis la table des utilisateurs.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  await fetch(`${config.authServiceUrl}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}
