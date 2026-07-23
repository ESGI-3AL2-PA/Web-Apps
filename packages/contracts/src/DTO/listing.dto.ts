import { z } from "../zod";

/**
 * DTO (schémas zod) de l'annonce (listing).
 *
 * Une annonce est publiée par un utilisateur dans un quartier, propose un service à un prix
 * exprimé en points, porte un statut de cycle de vie, des tags et des images. Ce fichier couvre
 * la réponse, la création/mise à jour et la requête de listing (filtres + tri serveur).
 */

// Les URLs d'images d'annonce doivent être en http(s) ; rejette javascript:/data: et autres schémas.
const imageUrl = z
  .string()
  .url()
  .refine((u) => /^https?:\/\//i.test(u), { message: "Image URL must be http(s)" });

// Cycle de vie d'une annonce : active, close, expirée.
export const ListingStatusSchema = z.enum(["active", "closed", "expired"]);
export type ListingStatus = z.infer<typeof ListingStatusSchema>;

// Ordres de tri serveur : plus récentes d'abord, ou par prix croissant/décroissant.
export const ListingSortSchema = z.enum(["recent", "price_asc", "price_desc"]);
export type ListingSort = z.infer<typeof ListingSortSchema>;

// Forme de réponse d'une annonce renvoyée par l'API.
export const ListingResponseDtoSchema = z
  .object({
    id: z.string().openapi({ description: "Unique listing identifier" }),
    authorId: z.string().openapi({ description: "ID of the user who created the listing" }),
    districtId: z.string().openapi({ description: "ID of the district this listing belongs to" }),
    title: z.string().openapi({ description: "Listing title", example: "Plumber available for small repairs" }),
    description: z.string().openapi({ description: "Detailed description of the listing" }),
    price: z.number().int().openapi({ description: "Price in tokens", example: 10 }),
    status: ListingStatusSchema.openapi({ description: "Current status of the listing" }),
    tags: z
      .array(z.string())
      .optional()
      .openapi({ description: "Tag names attached to this listing", example: ["gardening", "weekend-help"] }),
    images: z.array(z.string()).optional().openapi({ description: "URLs of images attached to this listing" }),
    // Renseigné côté serveur pour l'utilisateur authentifié : indique s'il a déjà pris ce service.
    userHasContract: z
      .boolean()
      .optional()
      .openapi({ description: "True si le user authentifié a déjà pris ce service" }),
    createdAt: z.string().datetime().openapi({ description: "Creation timestamp" }),
    expiresAt: z.string().datetime().optional().openapi({ description: "Expiry timestamp" }),
  })
  .openapi({ title: "ListingResponse" });
export type ListingResponseDto = z.infer<typeof ListingResponseDtoSchema>;

// Corps de création d'une annonce (l'auteur, le quartier et le statut sont dérivés côté serveur).
export const CreateListingDtoSchema = z
  .object({
    title: z
      .string()
      .min(1)
      .max(300)
      .openapi({ description: "Listing title", example: "Plumber available for small repairs" }),
    description: z.string().min(1).openapi({ description: "Detailed description" }),
    price: z.number().int().min(0).openapi({ description: "Price in tokens", example: 10 }),
    tags: z
      .array(z.string())
      .optional()
      .openapi({ description: "Tag names attached to this listing", example: ["gardening"] }),
    images: z
      .array(imageUrl)
      .max(8)
      .optional()
      .openapi({ description: "URLs of images attached to this listing (max 8)" }),
    expiresAt: z.string().datetime().optional(),
  })
  .openapi({ title: "CreateListing" });
export type CreateListingDto = z.infer<typeof CreateListingDtoSchema>;

// Corps de mise à jour partielle d'une annonce : tous les champs facultatifs, statut modifiable.
export const UpdateListingDtoSchema = z
  .object({
    title: z.string().min(1).max(300).optional(),
    description: z.string().min(1).optional(),
    price: z.number().int().min(0).optional(),
    status: ListingStatusSchema.optional(),
    tags: z.array(z.string()).optional(),
    images: z.array(imageUrl).max(8).optional(),
    expiresAt: z.string().datetime().optional(),
  })
  .openapi({ title: "UpdateListing" });
export type UpdateListingDto = z.infer<typeof UpdateListingDtoSchema>;

// Paramètre d'URL : identifiant de l'annonce.
export const ListingParamsDtoSchema = z.object({ id: z.string() }).openapi({ title: "ListingParams" });
export type ListingParamsDto = z.infer<typeof ListingParamsDtoSchema>;

// Query string de listing paginé, avec filtres facultatifs (statut, quartier, auteur, tag) et tri.
export const ListingQueryDtoSchema = z
  .object({
    // Pagination : page >= 1, 20 par défaut, plafonnée à 100 par page.
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    search: z.string().max(200).optional(),
    status: ListingStatusSchema.optional(),
    districtId: z.string().optional(),
    authorId: z.string().optional(),
    tag: z
      .string()
      .max(200)
      .optional()
      .openapi({ description: "Filter listings by a single tag name (Mongo array match)" }),
    sort: ListingSortSchema.optional()
      .default("recent")
      .openapi({ description: "Server-side ordering: newest first, or by ascending/descending price" }),
  })
  .openapi({ title: "ListingQuery" });
export type ListingQueryDto = z.infer<typeof ListingQueryDtoSchema>;
export type ListingQueryInput = z.input<typeof ListingQueryDtoSchema>;
