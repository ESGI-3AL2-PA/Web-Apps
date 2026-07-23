import type { District } from "../../entities/district.entity.js";
import type { IDistrictRepository, UpdateDistrictData } from "../../repositories/District/district.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import type { IUserRepository } from "../../repositories/User/user.repository.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";
import { checkMembersWithinPolygon } from "./check-members-within-polygon.use-case.js";

/**
 * Cas d'usage : mise à jour d'un quartier.
 * Couche use-case (apps/api). Vérifie l'invariant de frontière avant d'écrire, met à jour dans
 * Mongo, puis reprojette le noeud dans le graphe uniquement si le nom a changé.
 */

/**
 * Résultat de la mise à jour.
 * - `ok` : quartier mis à jour.
 * - `not-found` : aucun quartier pour cet identifiant.
 * - `members-outside` : la nouvelle frontière laisserait des membres hors du polygone (rejet).
 */
export type UpdateDistrictResult =
  | { kind: "ok"; district: District }
  | { kind: "not-found" }
  | { kind: "members-outside"; outside: { id: string; address: string }[] };

export const updateDistrictUseCase = (
  districtRepository: IDistrictRepository,
  graphRepository: IGraphRepository,
  userRepository: IUserRepository,
) => {
  return async (id: string, data: UpdateDistrictData): Promise<UpdateDistrictResult> => {
    // Garde-fou : un changement de frontière ne doit pas laisser des membres existants hors du
    // quartier. (geoJson null efface la frontière — plus rien à valider.)
    if (data.geoJson) {
      const outside = await checkMembersWithinPolygon(userRepository, id, data.geoJson);
      if (outside.length > 0) return { kind: "members-outside", outside };
    }

    const district = await districtRepository.updateDistrict(id, data);
    if (!district) return { kind: "not-found" };
    // On ne reprojette le noeud du graphe que si le nom a changé (seul attribut projeté).
    if (data.name !== undefined) {
      await syncGraph(`upsertDistrict(${district.id})`, () =>
        graphRepository.upsertDistrict({ id: district.id, name: district.name }),
      );
    }
    return { kind: "ok", district };
  };
};
