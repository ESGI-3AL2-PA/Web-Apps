import { z } from "zod";

// Entité Event (événement) : rassemblement organisé dans un quartier, avec un nombre
// de places limité et une liste d'inscrits.

// Statut de l'événement au fil de son cycle de vie (à venir -> en cours -> terminé, ou annulé).
export const EventStatusSchema = z.enum(["upcoming", "ongoing", "completed", "cancelled"]);
export type EventStatus = z.infer<typeof EventStatusSchema>;

export const EventSchema = z.object({
  id: z.string(),
  creatorId: z.string(),
  districtId: z.string(),
  title: z.string().min(1).max(300),
  description: z.string().min(1),
  location: z.string().min(1).max(500),
  // Capacité totale : au moins une place.
  totalSeats: z.number().int().min(1),
  // Places restantes ; décrémenté à chaque inscription, borné à 0.
  remainingSeats: z.number().int().min(0),
  status: EventStatusSchema,
  // Ids des utilisateurs inscrits.
  registrants: z.array(z.string()),
  eventDate: z.string().datetime(),
  createdAt: z.string().datetime(),
});

export type Event = z.infer<typeof EventSchema>;
