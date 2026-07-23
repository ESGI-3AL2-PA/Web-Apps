import { z } from "../zod";
import { GeoJsonSchema, GeoJsonInputSchema } from "./geoJson.dto";

/**
 * DTO (schémas zod) du quartier.
 *
 * Un quartier porte un nom, une frontière géographique GeoJSON facultative et un
 * capital de départ (`startingPoints`) crédité à tout nouveau membre. Réponse tolérante
 * sur le GeoJSON stocké, entrée stricte (Polygon/MultiPolygon validés) côté création/mise à jour.
 */

// Forme de réponse d'un quartier renvoyée par l'API.
export const DistrictResponseDtoSchema = z
  .object({
    id: z.string().openapi({ description: "Unique district identifier" }),
    name: z.string().openapi({ description: "District name", example: "Montmartre" }),
    geoJson: GeoJsonSchema.optional(),
    startingPoints: z
      .number()
      .int()
      .openapi({ description: "Tokens granted to a new member when they join this district" }),
  })
  .openapi({ title: "DistrictResponse" });
export type DistrictResponseDto = z.infer<typeof DistrictResponseDtoSchema>;

// Corps de création d'un quartier : nom 1-200 caractères, frontière et points de départ (>= 0).
export const CreateDistrictDtoSchema = z
  .object({
    name: z.string().min(1).max(200).openapi({ description: "District name", example: "Montmartre" }),
    geoJson: GeoJsonInputSchema.optional(),
    startingPoints: z
      .number()
      .int()
      .min(0)
      .openapi({ description: "Tokens granted to a new member when they join", example: 100 }),
  })
  .openapi({ title: "CreateDistrict" });
export type CreateDistrictDto = z.infer<typeof CreateDistrictDtoSchema>;

// Corps de mise à jour partielle : tous les champs sont facultatifs.
export const UpdateDistrictDtoSchema = z
  .object({
    name: z.string().min(1).max(200).optional().openapi({ description: "District name", example: "Montmartre" }),
    // null efface la frontière existante ; omis/undefined la laisse inchangée.
    geoJson: GeoJsonInputSchema.nullable().optional(),
    startingPoints: z
      .number()
      .int()
      .min(0)
      .optional()
      .openapi({ description: "Tokens granted to a new member when they join", example: 100 }),
  })
  .openapi({ title: "UpdateDistrict" });
export type UpdateDistrictDto = z.infer<typeof UpdateDistrictDtoSchema>;

// Paramètre d'URL : identifiant du quartier.
export const DistrictParamsDtoSchema = z.object({ id: z.string() }).openapi({ title: "DistrictParams" });
export type DistrictParamsDto = z.infer<typeof DistrictParamsDtoSchema>;

// Query string de listing paginé, avec recherche facultative par nom.
export const DistrictQueryDtoSchema = z
  .object({
    // Pagination : page >= 1, 20 par défaut, plafonnée à 100 par page.
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    search: z.string().max(200).optional().openapi({ description: "District name", example: "Montmartre" }),
  })
  .openapi({ title: "DistrictQuery" });
export type DistrictQueryDto = z.infer<typeof DistrictQueryDtoSchema>;
