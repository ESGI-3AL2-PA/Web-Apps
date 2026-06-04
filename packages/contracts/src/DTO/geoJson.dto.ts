import { z } from "../zod";

export const GeoJsonSchema = z
  .object({
    type: z.string().openapi({ description: "GeoJSON geometry type", example: "Polygon" }),
    // Coordinates nest arbitrarily by geometry type (Point: [lng,lat], Polygon: number[][][], …),
    // so they're left untyped here rather than forced to a flat number[].
    coordinates: z.array(z.unknown()).openapi({ description: "GeoJSON coordinates (shape depends on geometry type)" }),
  })
  .openapi("GeoJson");
export type GeoJson = z.infer<typeof GeoJsonSchema>;
