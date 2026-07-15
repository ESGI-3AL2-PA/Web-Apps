import { z } from "../zod";

// Tag display text is stored per language in the DB (not via frontend i18n keys),
// so tags render in the user's language. `name` stays the stable key (listing value,
// URL/query filter, graph key); `label` is what users read.
// Kept untitled so the OpenAPI generator inlines them at each usage rather than
// extracting one shared component (which collides when re-wrapped per field).
export const TagLabelSchema = z.object({
  fr: z.string().min(1).max(100),
  en: z.string().min(1).max(100),
});
export type TagLabel = z.infer<typeof TagLabelSchema>;

export const TagDescriptionSchema = z
  .object({
    fr: z.string().max(500),
    en: z.string().max(500),
  })
  .partial();
export type TagDescription = z.infer<typeof TagDescriptionSchema>;

export const TagResponseDtoSchema = z
  .object({
    id: z.string().openapi({ description: "Unique tag identifier" }),
    districtId: z.string().openapi({ description: "District this tag belongs to" }),
    name: z.string().openapi({ description: "Stable tag key", example: "plumbing" }),
    label: TagLabelSchema,
    description: TagDescriptionSchema.optional(),
  })
  .openapi({ title: "TagResponse" });
export type TagResponseDto = z.infer<typeof TagResponseDtoSchema>;

export const CreateTagDtoSchema = z
  .object({
    name: z.string().min(1).max(100).openapi({ description: "Stable tag key", example: "plumbing" }),
    label: TagLabelSchema,
    description: TagDescriptionSchema.optional(),
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
    label: TagLabelSchema.optional(),
    description: TagDescriptionSchema.optional(),
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
