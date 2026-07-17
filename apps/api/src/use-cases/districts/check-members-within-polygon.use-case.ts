import type { GeoJson } from "../../entities/district.entity.js";
import type { IUserRepository } from "../../repositories/User/user.repository.js";
import { getCoordinatesFromAddress } from "../../services/address.service.js";
import { isPointInGeometry } from "../../services/point-in-polygon.js";
import { logger } from "../../logger.js";

/**
 * Guards the district-boundary invariant "every member's address is inside the polygon".
 * Geocodes each current member and returns those whose address falls outside `polygon`.
 * A member whose address can't be geocoded is skipped (logged) rather than treated as
 * outside, so a transient geocoder failure can't wrongly block a legitimate boundary edit.
 *
 * NB: this geocodes once per member — acceptable for realistic district sizes, but it is a
 * fan-out of external calls on each create/update with a boundary.
 */
export const checkMembersWithinPolygon = async (
  userRepository: IUserRepository,
  districtId: string,
  polygon: GeoJson,
): Promise<{ id: string; address: string }[]> => {
  const members = await userRepository.findUsersByDistrict(districtId);
  const outside: { id: string; address: string }[] = [];

  for (const member of members) {
    let point: [number, number] | null = null;
    try {
      const geo = await getCoordinatesFromAddress(member.address);
      point = geo.coordinates as [number, number];
    } catch (err) {
      logger.warn({ err, userId: member.id, districtId }, "polygon guard: could not geocode member — skipped");
      continue;
    }
    if (!isPointInGeometry(point, polygon)) {
      outside.push({ id: member.id, address: member.address });
    }
  }

  return outside;
};
