import { z } from "../zod";

/**
 * DTO (schémas zod) de l'événement de quartier.
 *
 * Un événement appartient à un quartier, expose un nombre de places (total/restantes),
 * un statut de cycle de vie et la liste des inscrits. Ce fichier couvre la réponse,
 * la création/mise à jour, la requête de listing, l'inscription (`AttendEvent`) et le
 * signal d'intérêt (`MarkInterest`) alimentant le moteur de recommandation Neo4j.
 */

// Cycle de vie d'un événement : à venir, en cours, terminé, annulé.
export const EventStatusSchema = z.enum(["upcoming", "ongoing", "completed", "cancelled"]);
export type EventStatus = z.infer<typeof EventStatusSchema>;

// Forme de réponse d'un événement renvoyée par l'API.
export const EventResponseDtoSchema = z
  .object({
    id: z.string().openapi({ description: "Unique event identifier (UUID)" }),
    creatorId: z.string().openapi({ description: "UUID of the user who created the event" }),
    districtId: z.string().openapi({ description: "UUID of the district this event belongs to" }),
    title: z.string().openapi({ description: "Event title", example: "Neighbourhood cleanup" }),
    description: z.string().openapi({ description: "Detailed description of the event" }),
    location: z.string().openapi({ description: "Event location", example: "Place du Tertre, Montmartre" }),
    totalSeats: z.number().int().openapi({ description: "Total number of available seats" }),
    remainingSeats: z.number().int().openapi({ description: "Number of remaining seats" }),
    status: EventStatusSchema.openapi({ description: "Current status of the event" }),
    registrants: z.array(z.string()).openapi({ description: "List of registrant user IDs" }),
    eventDate: z.string().datetime().openapi({ description: "Event date and time (ISO 8601)" }),
    createdAt: z.string().datetime().openapi({ description: "Creation timestamp (ISO 8601)" }),
  })
  .openapi("EventResponse");
export type EventResponseDto = z.infer<typeof EventResponseDtoSchema>;

// Corps de création d'un événement (les places restantes et le statut sont dérivés côté serveur).
export const CreateEventDtoSchema = z
  .object({
    districtId: z.string().openapi({ description: "UUID of the district" }),
    title: z
      .string()
      .min(1)
      .max(300)
      .openapi({ description: "Event title (1-300 characters)", example: "Neighbourhood cleanup" }),
    description: z.string().min(1).openapi({ description: "Detailed description" }),
    location: z
      .string()
      .min(1)
      .max(500)
      .openapi({ description: "Event location (1-500 characters)", example: "Place du Tertre, Montmartre" }),
    totalSeats: z.number().int().min(1).max(1_000_000).openapi({ description: "Total number of seats (1–1,000,000)" }),
    eventDate: z.string().datetime().openapi({ description: "Event date and time (ISO 8601)" }),
  })
  // eventDate est un instant absolu (ISO 8601) : le comparer à `now` est donc insensible au
  // fuseau horaire — un événement ne peut pas être planifié dans le passé.
  .refine((data) => new Date(data.eventDate) > new Date(), {
    message: "eventDate must be in the future",
    path: ["eventDate"],
  })
  .openapi("CreateEvent");
export type CreateEventDto = z.infer<typeof CreateEventDtoSchema>;

// Corps de mise à jour partielle d'un événement : tous les champs facultatifs, statut modifiable.
export const UpdateEventDtoSchema = z
  .object({
    title: z.string().min(1).max(300).optional(),
    description: z.string().min(1).optional(),
    location: z.string().min(1).max(500).optional(),
    totalSeats: z.number().int().min(1).max(1_000_000).optional(),
    status: EventStatusSchema.optional(),
    eventDate: z.string().datetime().optional(),
  })
  // Pas de garde-fou de date future ici : les formulaires d'édition resoumettent l'eventDate
  // stockée, donc un événement déjà passé doit rester modifiable (corriger une faute, l'annuler).
  // Le garde-fou de date passée vit sur la création, où la date est toujours une saisie nouvelle.
  .openapi("UpdateEvent");
export type UpdateEventDto = z.infer<typeof UpdateEventDtoSchema>;

// Paramètre d'URL : identifiant de l'événement.
export const EventParamsDtoSchema = z.object({ id: z.string() }).openapi("EventParams");
export type EventParamsDto = z.infer<typeof EventParamsDtoSchema>;

// Query string de listing paginé, avec filtres facultatifs (quartier, créateur, statut, inscrit).
export const EventQueryDtoSchema = z
  .object({
    // Pagination : page >= 1, 20 par défaut, plafonnée à 100 par page.
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    search: z.string().max(200).optional(),
    districtId: z.string().optional(),
    creatorId: z.string().optional(),
    status: EventStatusSchema.optional(),
    registrantId: z
      .string()
      .optional()
      .openapi({ description: "Filter events where this user is registered (member of `registrants[]`)" }),
  })
  .openapi("EventQuery");
export type EventQueryDto = z.infer<typeof EventQueryDtoSchema>;
export type EventQueryInput = z.input<typeof EventQueryDtoSchema>;

// Corps d'inscription à un événement, avec note facultative (1 à 5) laissée par le participant.
export const AttendEventDtoSchema = z
  .object({
    rating: z.number().int().min(1).max(5).optional().openapi({ description: "Optional rating left by the attendee" }),
  })
  .openapi({ title: "AttendEvent" });
export type AttendEventDto = z.infer<typeof AttendEventDtoSchema>;

// Signal d'intérêt pour le moteur de recommandation Neo4j : 👍 = 1, 👎 = -1. Borné à ±1
// afin qu'un client ne puisse pas gonfler le score de reco cumulé avec une magnitude arbitraire.
export const MarkInterestDtoSchema = z
  .object({
    rating: z.union([z.literal(1), z.literal(-1)]),
  })
  .openapi({ title: "MarkInterest" });
export type MarkInterestDto = z.infer<typeof MarkInterestDtoSchema>;

// Réponse au signal d'intérêt : simple accusé de prise en compte.
export const MarkInterestResponseDtoSchema = z
  .object({ success: z.boolean() })
  .openapi({ title: "MarkInterestResponse" });
export type MarkInterestResponseDto = z.infer<typeof MarkInterestResponseDtoSchema>;
