import { z } from "zod";

export const ListingTypeSchema = z.enum(["offer", "request"]);
export type ListingType = z.infer<typeof ListingTypeSchema>;

export const ListingStatusSchema = z.enum(["active", "closed", "expired"]);
export type ListingStatus = z.infer<typeof ListingStatusSchema>;

export const ListingSchema = z.object({
  id: z.string(),
  authorId: z.string(),
  districtId: z.string(),
  title: z.string().min(1).max(300),
  description: z.string().min(1),
  type: ListingTypeSchema,
  price: z.number().int().min(0),
  status: ListingStatusSchema,
  tags: z.array(z.string()),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
});

export type Listing = z.infer<typeof ListingSchema>;
