import type { GeoJson, GeoJsonInput } from "@repo/contracts";
import type { District } from "../../entities/district.entity.js";
import type { IDistrictRepository } from "../../repositories/District/district.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import type { IUserRepository } from "../../repositories/User/user.repository.js";
import type { ITransactionRepository } from "../../repositories/Transaction/transaction.repository.js";
import type { IDistrictAdminRepository } from "../../repositories/DistrictAdmin/district-admin.repository.js";
import { getCoordinatesFromAddress } from "../../services/address.service.js";
import { logger } from "../../logger.js";
import { createDistrictUseCase } from "./create-district.use-case.js";
import { createDistrictAdminUseCase } from "../district-admins/create-district-admin.use-case.js";

/**
 * Cas d'usage : auto-création d'un quartier par un utilisateur (onboarding self-service).
 * Couche use-case (apps/api). Un simple utilisateur sans quartier géocode son adresse, obtient
 * un quartier avec une frontière provisoire autour de ce point, et devient administrateur de ce
 * quartier (avec adhésion et points de départ crédités). Orchestre createDistrictUseCase et
 * createDistrictAdminUseCase.
 */

/** Dépendances (repositories) injectées dans le cas d'usage. */
export interface CreateOwnDistrictDeps {
  userRepository: IUserRepository;
  districtRepository: IDistrictRepository;
  graphRepository: IGraphRepository;
  transactionRepository: ITransactionRepository;
  districtAdminRepository: IDistrictAdminRepository;
}

// Points de départ qu'un quartier auto-créé attribue à son fondateur (et à chaque futur membre
// qui le rejoint). Voir createDistrictAdminUseCase, qui les crédite à l'adhésion.
const FOUNDER_STARTING_POINTS = 100;

/**
 * Résultat de l'auto-création.
 * - `ok` : quartier créé.
 * - `forbidden` : l'appelant a déjà un quartier ou n'est pas un simple utilisateur.
 * - `geocode-failed` : l'adresse n'a pas pu être géocodée.
 */
export type CreateOwnDistrictResult =
  | { kind: "ok"; district: District }
  | { kind: "forbidden" } // l'appelant a déjà un quartier, ou n'est pas un simple utilisateur
  | { kind: "geocode-failed" };

// Petit carré en anneau fermé (~half*111km par degré) centré sur le point : la frontière
// provisoire d'un quartier auto-créé, que le nouvel administrateur redessinera ensuite.
const boxAroundPoint = (point: GeoJson, half = 0.001): GeoJsonInput => {
  const [lng, lat] = point.coordinates as [number, number];
  return {
    type: "Polygon",
    coordinates: [
      [
        [lng - half, lat - half],
        [lng + half, lat - half],
        [lng + half, lat + half],
        [lng - half, lat + half],
        [lng - half, lat - half],
      ],
    ],
  };
};

/**
 * Onboarding self-service d'un utilisateur sans quartier : géocode son adresse, crée un quartier
 * actif initialisé avec une box provisoire autour de ce point + un nom temporaire, et le promeut
 * administrateur de ce quartier (en réutilisant createDistrictAdminUseCase, qui rattache dans
 * district_admins, passe le rôle user→admin ET — le fondateur étant sans quartier — le fait
 * adhérer au quartier, renseigne son districtId et lui crédite les points de départ). Le client
 * le redirige ensuite vers l'app admin pour affiner le quartier.
 */
export const createOwnDistrictUseCase = (deps: CreateOwnDistrictDeps) => {
  return async (userId: string): Promise<CreateOwnDistrictResult> => {
    const user = await deps.userRepository.getUserById(userId);
    // Seul un simple utilisateur sans quartier peut s'amorcer un quartier à lui-même.
    if (!user || user.role !== "user" || user.districtId) return { kind: "forbidden" };

    let point: GeoJson;
    try {
      point = await getCoordinatesFromAddress(user.address);
    } catch (err) {
      logger.error({ err, userId }, "create-own-district: geocoding the address failed");
      return { kind: "geocode-failed" };
    }
    // Garde-fou : coordonnées absentes ou incomplètes => échec de géocodage.
    if (!Array.isArray(point?.coordinates) || point.coordinates.length < 2) return { kind: "geocode-failed" };

    const created = await createDistrictUseCase(
      deps.districtRepository,
      deps.graphRepository,
      deps.userRepository,
    )({
      name: `${user.firstName}'s district`,
      geoJson: boxAroundPoint(point),
      startingPoints: FOUNDER_STARTING_POINTS,
    });
    // Inatteignable : un quartier tout neuf n'a aucun membre, la garde du polygone ne peut donc pas se déclencher.
    if (created.kind !== "ok") return { kind: "geocode-failed" };

    // Rattache dans district_admins, promeut user→admin et (le fondateur étant sans quartier) le fait
    // adhérer au quartier — renseigne districtId et crédite les points de départ.
    await createDistrictAdminUseCase(deps.districtAdminRepository, {
      userRepository: deps.userRepository,
      transactionRepository: deps.transactionRepository,
      districtRepository: deps.districtRepository,
      graphRepository: deps.graphRepository,
    })({
      districtId: created.district.id,
      userId,
    });

    return { kind: "ok", district: created.district };
  };
};
