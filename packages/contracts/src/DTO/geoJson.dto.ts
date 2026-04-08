import { z } from "../zod";

export const GeoJsonSchema = z.object({
  type: z.string().openapi({ description: "GeoJSON geometry type", example: "Point" }),
  coordinates: z.tuple([z.number(), z.number()]).openapi({ description: "[longitude, latitude]", example: [2.3522, 48.8566] }),
}).openapi("GeoJson");
export type GeoJson = z.infer<typeof GeoJsonSchema>;
