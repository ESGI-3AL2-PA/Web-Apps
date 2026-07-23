import { z } from "zod";

// Entité Tag : catégorie d'annonces propre à un quartier, avec libellés multilingues.
// `name` est la clé stable (stockée sur les annonces, utilisée comme filtre URL/requête et clé de graphe).
// `label`/`description` portent le texte d'affichage par langue.

// Libellé affiché du tag : fr et en tous deux obligatoires (1 à 100 caractères).
export const TagLabelSchema = z.object({
  fr: z.string().min(1).max(100),
  en: z.string().min(1).max(100),
});

// Description facultative par langue (max 500) : `.partial()` rend chaque langue optionnelle.
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
