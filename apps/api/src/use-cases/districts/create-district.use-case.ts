import type { CreateDistrictDto } from "@repo/contracts";
import type { District } from "../../entities/district.entity.js";
import type { IDistrictRepository } from "../../repositories/District/district.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import type { IUserRepository } from "../../repositories/User/user.repository.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";
import { checkMembersWithinPolygon } from "./check-members-within-polygon.use-case.js";

/**
 * Cas d'usage : création d'un quartier.
 * Couche use-case (apps/api). Persiste le quartier dans Mongo puis projette le noeud
 * correspondant dans le graphe Neo4j. Vérifie l'invariant de frontière (aucun membre hors
 * du polygone) avant de valider la création.
 */

/**
 * Résultat de la création d'un quartier.
 * - `ok` : quartier créé.
 * - `members-outside` : la frontière fournie laisserait des membres existants hors du polygone ;
 *   la création est annulée et la liste des membres fautifs est renvoyée.
 */
export type CreateDistrictResult =
  | { kind: "ok"; district: District }
  | { kind: "members-outside"; outside: { id: string; address: string }[] };

/**
 * Factory du cas d'usage. Reçoit les repositories (quartier, graphe, utilisateur) et
 * renvoie la fonction d'exécution qui prend le DTO de création.
 */
export const createDistrictUseCase = (
  districtRepository: IDistrictRepository,
  graphRepository: IGraphRepository,
  userRepository: IUserRepository,
) => {
  return async (data: CreateDistrictDto): Promise<CreateDistrictResult> => {
    const district = await districtRepository.createDistrict(data);

    // On applique aussi l'invariant de frontière à la création. Un identifiant tout neuf
    // n'a encore aucun membre : ce contrôle ne mord donc que si l'id avait déjà des membres.
    // Le cas échéant, on annule l'insertion (rollback).
    if (data.geoJson) {
      const outside = await checkMembersWithinPolygon(userRepository, district.id, data.geoJson);
      if (outside.length > 0) {
        await districtRepository.deleteDistrict(district.id);
        return { kind: "members-outside", outside };
      }
    }

    // Projection best-effort du quartier dans le graphe (Mongo reste la source de vérité).
    await syncGraph(`upsertDistrict(${district.id})`, () =>
      graphRepository.upsertDistrict({ id: district.id, name: district.name }),
    );
    return { kind: "ok", district };
  };
};
