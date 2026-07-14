import { z } from "../zod";

export const TagResponseDtoSchema = z
  .object({
    id: z.string().openapi({ description: "Unique tag identifier" }),
    districtId: z.string().openapi({ description: "District this tag belongs to" }),
    name: z.string().openapi({ description: "Tag name", example: "plumbing" }),
    description: z.string().optional().openapi({ description: "Optional tag description" }),
  })
  .openapi({ title: "TagResponse" });
export type TagResponseDto = z.infer<typeof TagResponseDtoSchema>;

export const CreateTagDtoSchema = z
  .object({
    name: z.string().min(1).max(100).openapi({ description: "Tag name", example: "plumbing" }),
    description: z.string().optional().openapi({ description: "Optional tag description" }),
    districtId: z
      .string()
      .optional()
      .openapi({ description: "District to create the tag in (superAdmin/service only)" }),
  })
  .openapi({ title: "CreateTag" });
export type CreateTagDto = z.infer<typeof CreateTagDtoSchema>;

export const UpdateTagDtoSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().optional(),
  })
  .openapi({ title: "UpdateTag" });
export type UpdateTagDto = z.infer<typeof UpdateTagDtoSchema>;

export const TagParamsDtoSchema = z.object({ id: z.string() }).openapi({ title: "TagParams" });
export type TagParamsDto = z.infer<typeof TagParamsDtoSchema>;

export const TagQueryDtoSchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    search: z.string().max(200).optional(),
    districtId: z.string().optional(),
  })
  .openapi({ title: "TagQuery" });
export type TagQueryDto = z.infer<typeof TagQueryDtoSchema>;
