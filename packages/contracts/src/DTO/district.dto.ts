import { z } from "../zod";
import { GeoJsonSchema } from "./geoJson.dto";

export const DistrictResponseDtoSchema = z
  .object({
    id: z.string().openapi({ description: "Unique district identifier" }),
    name: z.string().openapi({ description: "District name", example: "Montmartre" }),
    geoJson: GeoJsonSchema.optional(),
  })
  .openapi({ title: "DistrictResponse" });
export type DistrictResponseDto = z.infer<typeof DistrictResponseDtoSchema>;

export const CreateDistrictDtoSchema = z
  .object({
    name: z.string().min(1).max(200).openapi({ description: "District name", example: "Montmartre" }),
    geoJson: GeoJsonSchema.optional(),
  })
  .openapi({ title: "CreateDistrict" });
export type CreateDistrictDto = z.infer<typeof CreateDistrictDtoSchema>;

export const UpdateDistrictDtoSchema = z
  .object({
    name: z.string().min(1).max(200).optional().openapi({ description: "District name", example: "Montmartre" }),
    geoJson: GeoJsonSchema.optional(),
  })
  .openapi({ title: "UpdateDistrict" });
export type UpdateDistrictDto = z.infer<typeof UpdateDistrictDtoSchema>;

export const DistrictParamsDtoSchema = z.object({ id: z.string() }).openapi({ title: "DistrictParams" });
export type DistrictParamsDto = z.infer<typeof DistrictParamsDtoSchema>;

export const DistrictQueryDtoSchema = z
  .object({
    page: z.number().int().min(1).optional().default(1),
    limit: z.number().int().min(1).max(100).optional().default(20),
    search: z.string().optional().openapi({ description: "District name", example: "Montmartre" }),
  })
  .openapi({ title: "DistrictQuery" });
export type DistrictQueryDto = z.infer<typeof DistrictQueryDtoSchema>;
