import { z } from "zod";

// Entité District (quartier) : périmètre géographique qui cloisonne toutes les autres
// données (annonces, événements, messages...). Chaque entité porte un districtId.

// Géométrie GeoJSON minimale (type + coordonnées) délimitant le quartier sur la carte.
export const GeoJsonSchema = z.object({
  type: z.string(),
  coordinates: z.array(z.unknown()),
});
export type GeoJson = z.infer<typeof GeoJsonSchema>;

export const DistrictSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(200),
  geoJson: GeoJsonSchema.optional(),
  // Points octroyés à un nouveau membre lorsqu'il rejoint ce quartier.
  startingPoints: z.number().int().min(0).default(0),
});

export type District = z.infer<typeof DistrictSchema>;
