import { z } from "../zod";

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
    tags: z.array(z.string()).openapi({ description: "Tags for categorisation", example: ["plumbing"] }),
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
    tags: z.array(z.string()).optional().default([]),
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
    search: z.string().optional(),
    type: ListingTypeSchema.optional(),
    status: ListingStatusSchema.optional(),
    districtId: z.string().optional(),
    authorId: z.string().optional(),
  })
  .openapi({ title: "ListingQuery" });
export type ListingQueryDto = z.infer<typeof ListingQueryDtoSchema>;
