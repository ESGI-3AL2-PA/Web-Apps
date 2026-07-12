import { z } from "../zod";

// Loose shape for RESPONSES — coordinates nest differently per geometry type and
// stored data is trusted, so it's left untyped rather than forced to a strict shape.
export const GeoJsonSchema = z
  .object({
    type: z.string().openapi({ description: "GeoJSON geometry type", example: "Polygon" }),
    coordinates: z.array(z.unknown()).openapi({ description: "GeoJSON coordinates (shape depends on geometry type)" }),
  })
  .openapi("GeoJson");
export type GeoJson = z.infer<typeof GeoJsonSchema>;

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

// Strict shape for REQUEST bodies (district create/update): validate Polygon and
// MultiPolygon up front so a bad boundary is rejected with a 400 instead of crashing
// the 2dsphere index with a 500.
export const GeoJsonInputSchema = z
  .discriminatedUnion("type", [
    z.object({ type: z.literal("Polygon"), coordinates: PolygonCoordinates }),
    z.object({ type: z.literal("MultiPolygon"), coordinates: z.array(PolygonCoordinates).min(1) }),
  ])
  .openapi("GeoJsonInput");
export type GeoJsonInput = z.infer<typeof GeoJsonInputSchema>;
