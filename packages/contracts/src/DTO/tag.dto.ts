// DTO (couche contracts) : schémas zod des tags (catégories d'annonces propres à un
// quartier). Le libellé affiché est stocké par langue en base — pas via les clés i18n
// du frontend — pour que le tag s'affiche dans la langue de l'utilisateur.
import { z } from "../zod";

// `name` reste la clé stable (valeur portée par l'annonce, filtre URL/query, clé de
// graphe) ; `label` est le texte lu par l'utilisateur, décliné fr/en.
// Schémas laissés sans `title` volontairement : le générateur OpenAPI les inline à
// chaque usage plutôt que d'extraire un composant partagé (qui entrerait en collision
// lorsqu'il est ré-enveloppé champ par champ).
/** Libellé d'un tag, obligatoire dans les deux langues (fr/en), 1..100 caractères. */
export const TagLabelSchema = z.object({
  fr: z.string().min(1).max(100),
  en: z.string().min(1).max(100),
});
export type TagLabel = z.infer<typeof TagLabelSchema>;

/** Description optionnelle d'un tag par langue (partielle : chaque langue est facultative), max 500 caractères. */
export const TagDescriptionSchema = z
  .object({
    fr: z.string().max(500),
    en: z.string().max(500),
  })
  .partial();
export type TagDescription = z.infer<typeof TagDescriptionSchema>;

/** Tag renvoyé par l'API : clé stable, quartier de rattachement, libellé multilingue et description optionnelle. */
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

/** Corps de création d'un tag. `districtId` réservé au superAdmin/service (sinon dérivé du quartier de l'appelant). */
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

/** Corps de mise à jour partielle d'un tag (tous les champs optionnels). */
export const UpdateTagDtoSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    label: TagLabelSchema.optional(),
    description: TagDescriptionSchema.optional(),
  })
  .openapi({ title: "UpdateTag" });
export type UpdateTagDto = z.infer<typeof UpdateTagDtoSchema>;

/** Param de route : identifiant du tag ciblé. */
export const TagParamsDtoSchema = z.object({ id: z.string() }).openapi({ title: "TagParams" });
export type TagParamsDto = z.infer<typeof TagParamsDtoSchema>;

/** Query de listing des tags : pagination, recherche texte et filtre par quartier. */
export const TagQueryDtoSchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    search: z.string().max(200).optional(),
    districtId: z.string().optional(),
  })
  .openapi({ title: "TagQuery" });
export type TagQueryDto = z.infer<typeof TagQueryDtoSchema>;
