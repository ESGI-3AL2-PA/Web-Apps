import { z } from "../zod";

// Listing image URLs must be http(s); reject javascript:/data: and other schemes.
const imageUrl = z
  .string()
  .url()
  .refine((u) => /^https?:\/\//i.test(u), { message: "Image URL must be http(s)" });

export const ListingTypeSchema = z.enum(["offer", "request"]);
export type ListingType = z.infer<typeof ListingTypeSchema>;

export const ListingStatusSchema = z.enum(["active", "closed", "expired"]);
export type ListingStatus = z.infer<typeof ListingStatusSchema>;

export const ListingResponseDtoSchema = z
  .object({
    id: z.string().openapi({ description: "Unique listing identifier" }),
    authorId: z.string().openapi({ description: "ID of the user who created the listing" }),
    districtId: z.string().openapi({ description: "ID of the district this listing belongs to" }),
    title: z.string().openapi({ description: "Listing title", example: "Plumber available for small repairs" }),
    description: z.string().openapi({ description: "Detailed description of the listing" }),
    type: ListingTypeSchema.openapi({ description: "Whether this is an offer or a request" }),
    price: z.number().int().openapi({ description: "Price in tokens", example: 10 }),
    status: ListingStatusSchema.openapi({ description: "Current status of the listing" }),
    tags: z
      .array(z.string())
      .optional()
      .openapi({ description: "Tag names attached to this listing", example: ["gardening", "weekend-help"] }),
    images: z.array(z.string()).optional().openapi({ description: "URLs of images attached to this listing" }),
    userHasContract: z
      .boolean()
      .optional()
      .openapi({ description: "True si le user authentifié a déjà pris ce service" }),
    createdAt: z.string().datetime().openapi({ description: "Creation timestamp" }),
    expiresAt: z.string().datetime().optional().openapi({ description: "Expiry timestamp" }),
  })
  .openapi({ title: "ListingResponse" });
export type ListingResponseDto = z.infer<typeof ListingResponseDtoSchema>;

export const CreateListingDtoSchema = z
  .object({
    title: z
      .string()
      .min(1)
      .max(300)
      .openapi({ description: "Listing title", example: "Plumber available for small repairs" }),
    description: z.string().min(1).openapi({ description: "Detailed description" }),
    type: ListingTypeSchema.openapi({ description: "offer or request" }),
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

export const UpdateListingDtoSchema = z
  .object({
    title: z.string().min(1).max(300).optional(),
    description: z.string().min(1).optional(),
    type: ListingTypeSchema.optional(),
    price: z.number().int().min(0).optional(),
    status: ListingStatusSchema.optional(),
    tags: z.array(z.string()).optional(),
    images: z.array(imageUrl).max(8).optional(),
    expiresAt: z.string().datetime().optional(),
  })
  .openapi({ title: "UpdateListing" });
export type UpdateListingDto = z.infer<typeof UpdateListingDtoSchema>;

export const ListingParamsDtoSchema = z.object({ id: z.string() }).openapi({ title: "ListingParams" });
export type ListingParamsDto = z.infer<typeof ListingParamsDtoSchema>;

export const ListingQueryDtoSchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    search: z.string().max(200).optional(),
    type: ListingTypeSchema.optional(),
    status: ListingStatusSchema.optional(),
    districtId: z.string().optional(),
    authorId: z.string().optional(),
    tag: z
      .string()
      .max(200)
      .optional()
      .openapi({ description: "Filter listings by a single tag name (Mongo array match)" }),
  })
  .openapi({ title: "ListingQuery" });
export type ListingQueryDto = z.infer<typeof ListingQueryDtoSchema>;
