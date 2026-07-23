// Helper — scoping par quartier des endpoints de liste.
//
// Le middleware authorize par enregistrement ne garde que les routes mono-enregistrement (no-op
// en l'absence de `:id`), donc les endpoints de collection/liste sont sinon sans scope. Ce module
// résout le quartier qu'une requête de liste peut lire : un résident (`user`) et un `admin` standard
// sont tous deux confinés à leur propre quartier et la valeur fournie par le client est ignorée ;
// `superAdmin` / `service` peuvent cibler n'importe quel quartier demandé.
//
// Renvoie soit le districtId à filtrer, soit `{ empty: true }` — signal que l'appelant (résident ou
// admin rattaché à aucun quartier) doit ne rien voir plutôt que tout voir.

import type { IUserRepository } from "../repositories/User/user.repository.js";

interface DistrictScopeUser {
  role: string;
  adminDistrictId?: string | null;
}

export type DistrictScopeResult = { districtId?: string } | { empty: true };

/** Résout le quartier de liste pour un admin / superAdmin / service (ne gère pas le rôle `user`). */
export function resolveListDistrictScope(user: DistrictScopeUser, requested?: string): DistrictScopeResult {
  if (user.role === "admin") {
    if (!user.adminDistrictId) return { empty: true }; // admin rattaché à aucun quartier → ne voit rien
    return { districtId: user.adminDistrictId }; // ignore la valeur fournie par le client
  }
  return { districtId: requested }; // superAdmin / service : respecte la demande telle quelle
}

// Idem, mais gère aussi le rôle `user`. Le quartier de résidence d'un résident n'est pas dans le JWT
// (seul `adminDistrictId` l'est), il faut donc le charger — d'où la variante async. À préférer à
// `resolveListDistrictScope` sur toute route accessible aux résidents : la version synchrone retombe
// pour eux sur « respecte la demande telle quelle », ce qui laisserait un résident énumérer les autres quartiers.
export async function resolveCallerListDistrict(
  user: DistrictScopeUser & { sub: string },
  requested: string | undefined,
  userRepo: IUserRepository,
): Promise<DistrictScopeResult> {
  if (user.role === "user") {
    const resident = await userRepo.getUserById(user.sub);
    if (!resident?.districtId) return { empty: true };
    return { districtId: resident.districtId }; // ignore la valeur fournie par le client
  }
  return resolveListDistrictScope(user, requested);
}

// Équivalent mono-enregistrement, pour les ressources publiques au quartier (annonces, événements,
// votes) où les métadonnées `scope` déclaratives ne conviennent pas : un ownerField y restreindrait à
// tort un résident à ses PROPRES enregistrements. Les appelants doivent répondre un refus par 404, pas
// 403, pour ne pas révéler l'existence d'un enregistrement d'un quartier voisin.
//
// `recordDistrictIds` prend un tableau pour que les votes (qui couvrent plusieurs quartiers) partagent ce chemin.
export async function callerCanReadDistrict(
  user: DistrictScopeUser & { sub: string },
  recordDistrictIds: string[],
  userRepo: IUserRepository,
): Promise<boolean> {
  if (user.role === "superAdmin" || user.role === "service") return true;
  if (user.role === "admin") {
    return !!user.adminDistrictId && recordDistrictIds.includes(user.adminDistrictId);
  }
  const resident = await userRepo.getUserById(user.sub);
  return !!resident?.districtId && recordDistrictIds.includes(resident.districtId);
}
