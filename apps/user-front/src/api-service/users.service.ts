// Service API des utilisateurs : profil, appartenance à un quartier, recherche de
// voisins et profils publics minimaux.
import type { DistrictResponseDto, ResolveDistrictResponseDto, UpdateUserDto, UserResponseDto } from "@repo/contracts";
import api from "./api";

// Profil public minimal exposé aux autres utilisateurs (identité seule).
export type UserPublic = { id: string; firstName: string; lastName: string };

/** GET /users/:id — profil complet (soi-même ou administrateur). */
export async function getUserById(id: string): Promise<UserResponseDto> {
  const res = await api.get<UserResponseDto>(`/users/${id}`);
  return res.data;
}

/** PATCH /users/:id — met à jour les champs de profil modifiables (soi-même ou administrateur). */
export async function updateUser(id: string, data: UpdateUserDto): Promise<UserResponseDto> {
  const res = await api.patch<UserResponseDto>(`/users/${id}`, data);
  return res.data;
}

/**
 * POST /users/me/resolve-district — re-géocode l'adresse de l'appelant et le rattache
 * au quartier qui la contient. Fournir un `districtId` pour trancher lorsque plusieurs
 * quartiers se chevauchent sur l'adresse.
 */
export async function resolveMyDistrict(districtId?: string): Promise<ResolveDistrictResponseDto> {
  const res = await api.post<ResolveDistrictResponseDto>("/users/me/resolve-district", { districtId });
  return res.data;
}

/** POST /users/me/district — crée un quartier actif autour de son adresse et en devient administrateur. */
export async function createMyDistrict(): Promise<DistrictResponseDto> {
  const res = await api.post<DistrictResponseDto>("/users/me/district", {});
  return res.data;
}

/** GET /users/public/search?q= — recherche de voisins par nom, limitée au quartier de l'appelant. */
export async function searchUsersPublic(q: string): Promise<UserPublic[]> {
  const res = await api.get<UserPublic[]>("/users/public/search", { params: { q } });
  return res.data ?? [];
}

// Cache mémoire des profils publics : mutualise les requêtes concurrentes/répétées
// par id. On stocke la Promise elle-même pour dédupliquer les appels en vol ; en cas
// d'échec on purge l'entrée pour permettre un nouvel essai.
const publicCache = new Map<string, Promise<UserPublic>>();

/** GET /users/:id/public — profil public minimal (nom), accessible à tout utilisateur authentifié. Mémoïsé. */
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
