import { z } from "../zod";
import { GeoJsonSchema, GeoJsonInputSchema } from "./geoJson.dto";

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

export const UpdateDistrictDtoSchema = z
  .object({
    name: z.string().min(1).max(200).optional().openapi({ description: "District name", example: "Montmartre" }),
    // null clears an existing boundary; omitted/undefined leaves it untouched.
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

export const DistrictParamsDtoSchema = z.object({ id: z.string() }).openapi({ title: "DistrictParams" });
export type DistrictParamsDto = z.infer<typeof DistrictParamsDtoSchema>;

export const DistrictQueryDtoSchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    search: z.string().max(200).optional().openapi({ description: "District name", example: "Montmartre" }),
  })
  .openapi({ title: "DistrictQuery" });
export type DistrictQueryDto = z.infer<typeof DistrictQueryDtoSchema>;
