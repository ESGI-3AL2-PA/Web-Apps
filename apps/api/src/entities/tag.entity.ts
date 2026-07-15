import { z } from "zod";

// `name` is the stable key (stored on listings, used as URL/query filter and graph key).
// `label`/`description` hold per-language display text.
export const TagLabelSchema = z.object({
  fr: z.string().min(1).max(100),
  en: z.string().min(1).max(100),
});

export const TagDescriptionSchema = z
  .object({
    fr: z.string().max(500),
    en: z.string().max(500),
  })
  .partial();

export const TagSchema = z.object({
  id: z.string(),
  districtId: z.string(),
  name: z.string().min(1).max(100),
  label: TagLabelSchema,
  description: TagDescriptionSchema.optional(),
});

export type Tag = z.infer<typeof TagSchema>;
