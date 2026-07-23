// Service géométrique (couche services) : test d'appartenance point-dans-polygone sur
// des géométries GeoJSON, sans dépendance ni aller-retour à l'index géo de Mongo.
import type { GeoJson } from "../entities/district.entity.js";

type Position = [number, number]; // [lng, lat]
type Ring = Position[];

// Test par lancer de rayon (ray-casting) : le point est-il à l'intérieur de l'anneau
// (extérieur ou trou) ? Les points sur la frontière comptent comme intérieurs. Les
// coordonnées sont en GeoJSON [lng, lat].
const pointInRing = (point: Position, ring: Ring): boolean => {
  const [x, y] = point;
  let inside = false;
  // Parcourt chaque arête (i, j) de l'anneau ; `j` suit `i` d'un cran en arrière (arête fermante).
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    // L'arête croise-t-elle le rayon horizontal partant du point ? Si oui, on bascule la parité.
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
};

// Un point est dans un polygone (liste d'anneaux) s'il est dans l'anneau extérieur et
// hors de chaque trou.
const pointInPolygon = (point: Position, rings: Ring[]): boolean => {
  if (rings.length === 0) return false;
  const [exterior, ...holes] = rings;
  if (!pointInRing(point, exterior!)) return false;
  return !holes.some((hole) => pointInRing(point, hole));
};

/**
 * Indique si le point donné tombe à l'intérieur d'une géométrie GeoJSON Polygon ou
 * MultiPolygon. Sert à garantir que les membres d'un quartier restent dans sa frontière
 * sans aller-retour à l'index géo de Mongo (le polygone candidat n'est pas encore
 * persisté au moment de la validation).
 */
export const isPointInGeometry = (point: Position, geometry: GeoJson): boolean => {
  const coordinates = geometry.coordinates as unknown;
  if (geometry.type === "Polygon") {
    return pointInPolygon(point, coordinates as Ring[]);
  }
  if (geometry.type === "MultiPolygon") {
    return (coordinates as Ring[][]).some((polygon) => pointInPolygon(point, polygon));
  }
  return false;
};
