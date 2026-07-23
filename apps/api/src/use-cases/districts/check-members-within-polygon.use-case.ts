// Cas d'usage (couche districts) : garde-fou de la frontière d'un quartier.
import type { GeoJson } from "../../entities/district.entity.js";
import type { IUserRepository } from "../../repositories/User/user.repository.js";
import { getCoordinatesFromAddress } from "../../services/address.service.js";
import { isPointInGeometry } from "../../services/point-in-polygon.js";
import { logger } from "../../logger.js";

/**
 * Garantit l'invariant de frontière de quartier « l'adresse de chaque membre est dans le
 * polygone ». Géocode chaque membre actuel et renvoie ceux dont l'adresse tombe hors de
 * `polygon`. Un membre dont l'adresse ne peut pas être géocodée est ignoré (loggé) plutôt
 * que considéré comme hors zone : ainsi une panne transitoire du géocodeur ne peut pas
 * bloquer à tort une modification légitime de frontière.
 *
 * NB : cela géocode une fois par membre — acceptable pour des tailles de quartier
 * réalistes, mais c'est un fan-out d'appels externes à chaque création/mise à jour avec
 * frontière.
 *
 * @param userRepository repository des utilisateurs (pour lister les membres du quartier)
 * @param districtId identifiant du quartier
 * @param polygon géométrie GeoJSON de la frontière à valider
 * @returns la liste { id, address } des membres situés hors du polygone
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
      // Échec de géocodage : on saute ce membre (voir NB ci-dessus) au lieu de le compter hors zone.
      logger.warn({ err, userId: member.id, districtId }, "polygon guard: could not geocode member — skipped");
      continue;
    }
    if (!isPointInGeometry(point, polygon)) {
      outside.push({ id: member.id, address: member.address });
    }
  }

  return outside;
};
