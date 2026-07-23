import { z } from "zod";

// Entité Listing (annonce) : offre de bien ou service publiée par un habitant dans son
// quartier, tarifée en points et catégorisée par tags.

// Statut de l'annonce (active, clôturée manuellement, ou expirée par date).
export const ListingStatusSchema = z.enum(["active", "closed", "expired"]);
export type ListingStatus = z.infer<typeof ListingStatusSchema>;

export const ListingSchema = z.object({
  id: z.string(),
  authorId: z.string(),
  districtId: z.string(),
  title: z.string().min(1).max(300),
  description: z.string().min(1),
  // Prix en points (entier ≥ 0).
  price: z.number().int().min(0),
  status: ListingStatusSchema,
  // Noms de tags (clé stable des Tag), servant de filtres.
  tags: z.array(z.string()),
  // URLs d'images ; par défaut liste vide.
  images: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
  // Date d'expiration facultative au-delà de laquelle l'annonce passe `expired`.
  expiresAt: z.string().datetime().optional(),
});

export type Listing = z.infer<typeof ListingSchema>;
