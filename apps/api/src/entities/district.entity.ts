import { z } from "zod";

export const GeoJsonSchema = z.object({
  type: z.string(),
  coordinates: z.array(z.unknown()),
});
export type GeoJson = z.infer<typeof GeoJsonSchema>;

export const DistrictSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(200),
  geoJson: GeoJsonSchema.optional(),
  // Tokens granted to a new member when they join this district.
  startingPoints: z.number().int().min(0).default(0),
});

export type District = z.infer<typeof DistrictSchema>;
