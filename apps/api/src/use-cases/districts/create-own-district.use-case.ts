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

export interface CreateOwnDistrictDeps {
  userRepository: IUserRepository;
  districtRepository: IDistrictRepository;
  graphRepository: IGraphRepository;
  transactionRepository: ITransactionRepository;
  districtAdminRepository: IDistrictAdminRepository;
}

// Starting points a self-created district seeds for its founder (and every future
// member who joins it). See createDistrictAdminUseCase, which grants them on join.
const FOUNDER_STARTING_POINTS = 100;

export type CreateOwnDistrictResult =
  | { kind: "ok"; district: District }
  | { kind: "forbidden" } // caller already has a district, or isn't a plain user
  | { kind: "geocode-failed" };

// A small closed-ring square (~half*111km per degree) centred on the point — the placeholder
// boundary a self-created district starts with, which the new admin then redraws.
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
 * Self-service onboarding for a district-less user: geocode their address, spin up an active
 * district seeded with a placeholder box around that point + a temp name, and promote them to
 * admin of it (reusing createDistrictAdminUseCase, which links district_admins, sets role
 * user→admin, AND — since the founder is district-less — joins them to the district, setting
 * their districtId and granting its starting points). The client then redirects them into the
 * admin app to refine the district.
 */
export const createOwnDistrictUseCase = (deps: CreateOwnDistrictDeps) => {
  return async (userId: string): Promise<CreateOwnDistrictResult> => {
    const user = await deps.userRepository.getUserById(userId);
    // Only a plain, district-less user may bootstrap a district for themselves.
    if (!user || user.role !== "user" || user.districtId) return { kind: "forbidden" };

    let point: GeoJson;
    try {
      point = await getCoordinatesFromAddress(user.address);
    } catch (err) {
      logger.error({ err, userId }, "create-own-district: geocoding the address failed");
      return { kind: "geocode-failed" };
    }
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
    // Unreachable: a brand-new district has no members, so the polygon guard can't trip.
    if (created.kind !== "ok") return { kind: "geocode-failed" };

    // Link district_admins, promote user→admin, and (founder is district-less) join
    // them to the district — setting districtId and granting its starting points.
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
