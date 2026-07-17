import type { GeoJson } from "../entities/district.entity.js";

type Position = [number, number]; // [lng, lat]
type Ring = Position[];

// Ray-casting test: is the point inside the ring (exterior or hole)? Boundary points
// count as inside. Coordinates are GeoJSON [lng, lat].
const pointInRing = (point: Position, ring: Ring): boolean => {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
};

// A point is inside one polygon (a list of rings) if it is inside the exterior ring and
// outside every hole.
const pointInPolygon = (point: Position, rings: Ring[]): boolean => {
  if (rings.length === 0) return false;
  const [exterior, ...holes] = rings;
  if (!pointInRing(point, exterior!)) return false;
  return !holes.some((hole) => pointInRing(point, hole));
};

/**
 * Whether the given point falls inside a GeoJSON Polygon or MultiPolygon geometry.
 * Used to guard that a district's members stay within its boundary without a round-trip
 * to Mongo's geo index (the candidate polygon isn't persisted yet at validation time).
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
