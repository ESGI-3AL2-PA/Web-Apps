import { z } from "../zod";

// A GeoJSON position: [lng, lat] (extra elevation values tolerated) within valid ranges.
const Position = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]).rest(z.number());

// A linear ring: at least 4 positions and closed (first === last), per the GeoJSON
// spec and Mongo's 2dsphere index — which otherwise throws a 500 on a malformed ring.
const LinearRing = z
  .array(Position)
  .min(4, "A polygon ring needs at least 4 positions (closed)")
  .refine((ring) => {
    const first = ring[0];
    const last = ring[ring.length - 1];
    return first[0] === last[0] && first[1] === last[1];
  }, "A polygon ring must be closed (first and last position identical)");

const PolygonCoordinates = z.array(LinearRing).min(1);

// District boundaries are stored as Polygon or MultiPolygon; validate both strictly
// so a bad shape is rejected with a 400 up front instead of crashing 2dsphere.
export const GeoJsonSchema = z
  .discriminatedUnion("type", [
    z.object({ type: z.literal("Polygon"), coordinates: PolygonCoordinates }),
    z.object({ type: z.literal("MultiPolygon"), coordinates: z.array(PolygonCoordinates).min(1) }),
  ])
  .openapi("GeoJson");
export type GeoJson = z.infer<typeof GeoJsonSchema>;
