import { z } from "../zod";

export const EventStatusSchema = z.enum(["upcoming", "ongoing", "completed", "cancelled"]);
export type EventStatus = z.infer<typeof EventStatusSchema>;

export const EventResponseDtoSchema = z.object({
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
}).openapi("EventResponse");
export type EventResponseDto = z.infer<typeof EventResponseDtoSchema>;

export const CreateEventDtoSchema = z.object({
  districtId: z.string().openapi({ description: "UUID of the district" }),
  title: z.string().min(1).max(300).openapi({ description: "Event title (1-300 characters)", example: "Neighbourhood cleanup" }),
  description: z.string().min(1).openapi({ description: "Detailed description" }),
  location: z.string().min(1).max(500).openapi({ description: "Event location (1-500 characters)", example: "Place du Tertre, Montmartre" }),
  totalSeats: z.number().int().min(1).openapi({ description: "Total number of seats (minimum 1)" }),
  eventDate: z.string().datetime().openapi({ description: "Event date and time (ISO 8601)" }),
}).openapi("CreateEvent");
export type CreateEventDto = z.infer<typeof CreateEventDtoSchema>;

export const UpdateEventDtoSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().min(1).optional(),
  location: z.string().min(1).max(500).optional(),
  totalSeats: z.number().int().min(1).optional(),
  status: EventStatusSchema.optional(),
  eventDate: z.string().datetime().optional(),
}).openapi("UpdateEvent");
export type UpdateEventDto = z.infer<typeof UpdateEventDtoSchema>;

export const EventParamsDtoSchema = z.object({ id: z.string() }).openapi("EventParams");
export type EventParamsDto = z.infer<typeof EventParamsDtoSchema>;

export const EventQueryDtoSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().optional(),
  districtId: z.string().optional(),
  status: EventStatusSchema.optional(),
}).openapi("EventQuery");
export type EventQueryDto = z.infer<typeof EventQueryDtoSchema>;
