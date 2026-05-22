import { z } from "zod";

export const EventStatusSchema = z.enum(["upcoming", "ongoing", "completed", "cancelled"]);
export type EventStatus = z.infer<typeof EventStatusSchema>;

export const EventSchema = z.object({
  id: z.string(),
  creatorId: z.string(),
  districtId: z.string(),
  title: z.string().min(1).max(300),
  description: z.string().min(1),
  location: z.string().min(1).max(500),
  totalSeats: z.number().int().min(1),
  remainingSeats: z.number().int().min(0),
  status: EventStatusSchema,
  registrants: z.array(z.string()),
  eventDate: z.string().datetime(),
  createdAt: z.string().datetime(),
});

export type Event = z.infer<typeof EventSchema>;
