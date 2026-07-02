import type { Tag } from "../../entities/tag.entity.js";

/**
 * Base set of tags every district should have available on creation.
 * Seeded idempotently by name — editing this list only adds missing tags,
 * it does not update or remove existing ones.
 */
export const DEFAULT_TAGS: Array<Omit<Tag, "id" | "districtId">> = [
  { name: "plumbing", description: "Plumbing and water-related services" },
  { name: "electrical", description: "Electrical work and repairs" },
  { name: "gardening", description: "Gardening and outdoor maintenance" },
  { name: "cleaning", description: "Cleaning and housekeeping" },
  { name: "moving", description: "Moving and heavy lifting" },
  { name: "childcare", description: "Babysitting and childcare" },
  { name: "tutoring", description: "Lessons and tutoring" },
  { name: "pets", description: "Pet care and walking" },
  { name: "diy", description: "DIY, repairs and handiwork" },
  { name: "transport", description: "Rides and transport" },
];
